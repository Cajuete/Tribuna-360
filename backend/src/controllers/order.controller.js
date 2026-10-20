const { supabase } = require('../config/supabase');

const VALID_STATUSES = ['pending', 'paid', 'shipped', 'cancelled'];

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
            error: error.message
        });
    }
};

const getMyOrders = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*, products(name, description, image_url), tenants(name)')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al obtener tus pedidos',
            error: error.message
        });
    }
};

const getOrders = async (req, res) => {
    try {
        let query = supabase
            .from('orders')
            .select('*, users(email, full_name), products(name, image_url), tenants(name)')
            .order('created_at', { ascending: false });

        if (req.user.role !== 'superadmin') {
            query = query.eq('tenant_id', req.user.tenant_id);
        }
        if (req.query.status) {
            query = query.eq('status', req.query.status);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al obtener los pedidos',
            error: error.message
        });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

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

        const { data, error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

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
            error: error.message
        });
    }
};

module.exports = {
    createOrder,
    getMyOrders,
    getOrders,
    updateOrderStatus
};
