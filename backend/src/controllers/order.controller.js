const { supabase } = require('../config/supabase');
const crypto = require('crypto');

const DELIVERY_PROOF_BUCKET = 'delivery-proofs';
const DELIVERY_PROOF_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const attachDeliveryProofs = async (orders) => Promise.all((orders || []).map(async order => {
    if (!order.delivery_proof_path) return order;
    const { data, error } = await supabase.storage
        .from(DELIVERY_PROOF_BUCKET)
        .createSignedUrl(order.delivery_proof_path, 10 * 60);
    if (error) throw error;
    return { ...order, delivery_proof_url: data.signedUrl };
}));

const createOrder = async (req, res) => {
    try {
        const { product_id, quantity } = req.body;
        const user_id = req.user.id;
        const qty = Number.parseInt(quantity, 10);

        if (!product_id || !Number.isInteger(qty) || qty < 1 || qty > 10) {
            return res.status(400).json({
                success: false,
                message: 'Datos inválidos: se requiere producto y cantidad (entre 1 y 10).'
            });
        }

        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, tenant_id, name, price, stock')
            .eq('id', product_id)
            .single();

        if (productError || !product) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
        }

        const { data: updated, error: stockError } = await supabase
            .from('products')
            .update({ stock: product.stock - qty })
            .eq('id', product_id)
            .gte('stock', qty)
            .select('id, stock');

        if (stockError) throw stockError;

        if (!updated || updated.length === 0) {
            return res.status(409).json({
                success: false,
                message: `Stock insuficiente de ${product.name}: quedan ${product.stock} unidad(es).`
            });
        }

        const unit_price = product.price;
        const total = unit_price * qty;

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert([{
                tenant_id: product.tenant_id,
                user_id,
                product_id,
                quantity: qty,
                unit_price,
                total,
                status: 'paid'
            }])
            .select()
            .single();

        if (orderError) {
            await supabase.from('products').update({ stock: product.stock }).eq('id', product_id);
            throw orderError;
        }

        return res.status(201).json({
            success: true,
            message: `Compra realizada: ${qty} × ${product.name} (pago simulado).`,
            data: order
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al procesar el pedido',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message)
        });
    }
};

const getMyOrders = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*, products(name, description, image_url), tenants(name), payments!orders_payment_id_fkey(purchase_data)')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const orders = (data || []).map(({ payments, ...order }) => ({
            ...order,
            delivery: payments?.purchase_data?.delivery || null,
        }));
        return res.status(200).json({ success: true, data: await attachDeliveryProofs(orders) });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al obtener tus pedidos',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message)
        });
    }
};

const getOrders = async (req, res) => {
    try {
        const isDeliveryManager = req.user.role === 'delivery_manager';
        const canViewDelivery = ['superadmin', 'club_admin', 'sales_manager', 'delivery_manager'].includes(req.user.role);
        const deliverySelect = canViewDelivery ? ', payments!orders_payment_id_fkey(purchase_data)' : '';
        let query = supabase
            .from('orders')
            .select(`*, users!orders_user_id_fkey(email, full_name), products(name, image_url), tenants(name)${deliverySelect}`)
            .order('created_at', { ascending: false });

        if (req.user.role !== 'superadmin') {
            query = query.eq('tenant_id', req.user.tenant_id);
        }
        if (isDeliveryManager) {
            query = query.in('status', ['paid', 'shipped', 'delivered']);
        }
        if (req.query.status) {
            query = query.eq('status', req.query.status);
        }

        const { data, error } = await query;
        if (error) throw error;

        const orders = canViewDelivery
            ? (data || []).map(({ payments, ...order }) => ({
                ...order,
                delivery: payments?.purchase_data?.delivery || null,
            }))
            : (data || []).map(({ delivery_proof_path, delivered_by, ...order }) => order);
        const responseOrders = canViewDelivery ? await attachDeliveryProofs(orders) : orders;
        return res.status(200).json({ success: true, data: responseOrders });
    } catch (error) {
        console.error('[Orders] No se pudieron obtener los pedidos:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener los pedidos',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message)
        });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (req.user.role === 'delivery_manager' && status !== 'shipped') {
            return res.status(403).json({ success: false, message: 'El despachador solo puede preparar pedidos pagados para su entrega.' });
        }
        if (!['shipped', 'cancelled'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Estado inválido: se permite "shipped" o "cancelled".'
            });
        }

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*, products(stock)')
            .eq('id', id)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
        }

        if (req.user.role !== 'superadmin' && order.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({ success: false, message: 'Pedido de otro club.' });
        }

        if (order.status !== 'paid') {
            return res.status(400).json({
                success: false,
                message: 'Solo pedidos en estado "paid" pueden modificarse.'
            });
        }

        let updateQuery = supabase
            .from('orders')
            .update({ status })
            .eq('tenant_id', order.tenant_id)
            .eq('status', 'paid');
        updateQuery = status === 'shipped' && order.payment_id
            ? updateQuery.eq('payment_id', order.payment_id)
            : updateQuery.eq('id', id);
        const { data, error } = await updateQuery.select();

        if (error) throw error;
        if (!data?.length) {
            return res.status(409).json({ success: false, message: 'El pedido cambió de estado. Actualiza la lista e inténtalo de nuevo.' });
        }

        if (status === 'cancelled') {
            await supabase
                .from('products')
                .update({ stock: order.products.stock + order.quantity })
                .eq('id', order.product_id);
        }

        return res.status(200).json({
            success: true,
            message: status === 'cancelled'
                ? 'Pedido cancelado. Stock restaurado.'
                : 'Pedido despachado.',
            data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al actualizar el pedido',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message)
        });
    }
};

const markOrderDelivered = async (req, res) => {
    let uploadedPath = null;
    try {
        const { id } = req.params;
        if (!req.file || !DELIVERY_PROOF_TYPES[req.file.mimetype]) {
            return res.status(400).json({ success: false, message: 'Adjunta una foto JPG, PNG o WEBP como comprobante de entrega.' });
        }
        if (req.file.size > 5 * 1024 * 1024) {
            return res.status(400).json({ success: false, message: 'La foto de entrega no puede superar 5 MB.' });
        }

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, tenant_id, payment_id, status')
            .eq('id', id)
            .maybeSingle();
        if (orderError) throw orderError;
        if (!order) return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
        if (req.user.role !== 'superadmin' && req.user.tenant_id !== order.tenant_id) {
            return res.status(403).json({ success: false, message: 'Pedido de otro club.' });
        }
        if (order.status !== 'shipped') {
            return res.status(409).json({ success: false, message: 'Solo se puede confirmar la entrega de un pedido que ya está en despacho.' });
        }

        uploadedPath = `${order.tenant_id}/${order.payment_id || order.id}/${crypto.randomUUID()}.${DELIVERY_PROOF_TYPES[req.file.mimetype]}`;
        const { error: uploadError } = await supabase.storage
            .from(DELIVERY_PROOF_BUCKET)
            .upload(uploadedPath, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600',
                upsert: false,
            });
        if (uploadError) throw uploadError;

        let updateQuery = supabase
            .from('orders')
            .update({
                status: 'delivered',
                delivery_proof_path: uploadedPath,
                delivered_at: new Date().toISOString(),
                delivered_by: req.user.id,
            })
            .eq('tenant_id', order.tenant_id)
            .eq('status', 'shipped');
        updateQuery = order.payment_id
            ? updateQuery.eq('payment_id', order.payment_id)
            : updateQuery.eq('id', order.id);
        const { data, error } = await updateQuery.select('id, status, delivered_at');
        if (error) throw error;
        if (!data?.length) {
            const { error: cleanupError } = await supabase.storage
                .from(DELIVERY_PROOF_BUCKET)
                .remove([uploadedPath]);
            if (cleanupError) console.error('[Orders] No se pudo limpiar la foto de entrega:', cleanupError.message);
            uploadedPath = null;
            return res.status(409).json({ success: false, message: 'El pedido cambió de estado. Actualiza la lista e inténtalo de nuevo.' });
        }

        uploadedPath = null;
        return res.status(200).json({
            success: true,
            message: 'Entrega confirmada con foto.',
            data,
        });
    } catch (error) {
        if (uploadedPath) {
            const { error: cleanupError } = await supabase.storage
                .from(DELIVERY_PROOF_BUCKET)
                .remove([uploadedPath]);
            if (cleanupError) console.error('[Orders] No se pudo limpiar la foto de entrega:', cleanupError.message);
        }
        console.error('[Orders] No se pudo confirmar la entrega:', error.message);
        return res.status(500).json({ success: false, message: 'No se pudo confirmar la entrega.' });
    }
};

module.exports = {
    createOrder,
    getMyOrders,
    getOrders,
    updateOrderStatus,
    markOrderDelivered,
};
