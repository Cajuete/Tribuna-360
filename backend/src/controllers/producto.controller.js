const { supabase } = require('../config/supabase');

const isMissingCategoryColumn = (error) => {
    if (!error) return false;
    return error.code === 'PGRST204' ||
        /category/i.test(error.message || '') ||
        /column .* does not exist/i.test(error.message || '');
};

const getProducts = async (req, res) => {
    try {
        let query = supabase
            .from('products')
            .select('*, tenants(name, slug)')
            .order('created_at', { ascending: false });

        if (req.query.tenant_id) {
            query = query.eq('tenant_id', req.query.tenant_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al obtener los productos', error: error.message });
    }
};

const createProduct = async (req, res) => {
    try {
        const { name, description, category, price, stock, image_url } = req.body;
        let tenant_id = req.body.tenant_id;

        if (req.user.role !== 'superadmin') {
            tenant_id = req.user.tenant_id;
        }

        const priceNum = Number(price);
        const stockNum = Number.parseInt(stock, 10);

        if (!tenant_id || !name || !name.trim() || !Number.isFinite(priceNum) || priceNum < 0 || !Number.isInteger(stockNum) || stockNum < 0) {
            return res.status(400).json({
                success: false,
                message: 'Datos inválidos: club, nombre, precio (>=0) y stock (>=0) son requeridos.'
            });
        }

        const payload = {
            tenant_id,
            name: name.trim(),
            description: description && description.trim() ? description.trim() : null,
            price: priceNum,
            stock: stockNum,
            image_url: image_url || null
        };

        if (category && category.trim()) payload.category = category.trim();

        const { data, error } = await supabase
            .from('products')
            .insert([payload])
            .select();

        if (error) {
            if (isMissingCategoryColumn(error)) {
                return res.status(400).json({
                    success: false,
                    message: 'Falta aplicar la migración 004_product_details.sql para guardar la categoría.'
                });
            }
            throw error;
        }

        return res.status(201).json({
            success: true,
            message: 'Producto registrado exitosamente en la tienda',
            product: data[0]
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al registrar el producto', error: error.message });
    }
};

const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: product } = await supabase
            .from('products')
            .select('id, tenant_id, name')
            .eq('id', id)
            .maybeSingle();

        if (!product) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
        }

        if (req.user.role !== 'superadmin' && product.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({ success: false, message: 'Producto de otro club.' });
        }

        const has = (key) => Object.prototype.hasOwnProperty.call(req.body, key);
        const patch = {};

        if (has('name')) {
            if (!req.body.name || !req.body.name.trim()) {
                return res.status(400).json({ success: false, message: 'El nombre no puede estar vacío.' });
            }
            patch.name = req.body.name.trim();
        }

        if (has('description')) {
            patch.description = req.body.description && req.body.description.trim() ? req.body.description.trim() : null;
        }

        if (has('category')) {
            patch.category = req.body.category && req.body.category.trim() ? req.body.category.trim() : null;
        }

        if (has('price')) {
            const n = Number(req.body.price);
            if (!Number.isFinite(n) || n < 0) {
                return res.status(400).json({ success: false, message: 'Precio inválido.' });
            }
            patch.price = n;
        }

        if (has('stock')) {
            const n = Number.parseInt(req.body.stock, 10);
            if (!Number.isInteger(n) || n < 0) {
                return res.status(400).json({ success: false, message: 'Stock inválido.' });
            }
            patch.stock = n;
        }

        if (has('image_url')) {
            patch.image_url = req.body.image_url || null;
        }

        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ success: false, message: 'No se envió ningún campo para actualizar.' });
        }

        const { data, error } = await supabase
            .from('products')
            .update(patch)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (isMissingCategoryColumn(error)) {
                return res.status(400).json({
                    success: false,
                    message: 'Falta aplicar la migración 004_product_details.sql para guardar la categoría.'
                });
            }
            throw error;
        }

        return res.status(200).json({
            success: true,
            message: `Producto "${data.name}" actualizado.`,
            product: data
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al actualizar el producto', error: error.message });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: product } = await supabase
            .from('products')
            .select('id, tenant_id, name')
            .eq('id', id)
            .maybeSingle();

        if (!product) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
        }

        if (req.user.role !== 'superadmin' && product.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({ success: false, message: 'Producto de otro club.' });
        }

        const { count } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('product_id', id);

        if (count > 0) {
            return res.status(409).json({
                success: false,
                message: `No se puede eliminar "${product.name}": tiene ${count} pedido(s).`
            });
        }

        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;

        return res.status(200).json({ success: true, message: `Producto "${product.name}" eliminado.` });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al eliminar el producto', error: error.message });
    }
};

module.exports = {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct
};
