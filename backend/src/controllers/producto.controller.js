const { supabase } = require('../config/supabase');

const getProducts = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*, tenants(name, slug)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al obtener los productos', error: error.message });
    }
};

const createProduct = async (req, res) => {
    try {
        const { name, description, price, stock, image_url } = req.body;
        let tenant_id = req.body.tenant_id;

        if (req.user.role !== 'superadmin') {
            tenant_id = req.user.tenant_id;
        }

        const priceNum = Number(price);
        const stockNum = Number.parseInt(stock, 10);

        if (!tenant_id || !name || !Number.isFinite(priceNum) || priceNum < 0 || !Number.isInteger(stockNum) || stockNum < 0) {
            return res.status(400).json({
                success: false,
                message: 'Datos inválidos: club, nombre, precio (>=0) y stock (>=0) son requeridos.'
            });
        }

        const { data, error } = await supabase
            .from('products')
            .insert([{ tenant_id, name, description, price: priceNum, stock: stockNum, image_url: image_url || null }])
            .select();

        if (error) throw error;

        return res.status(201).json({
            success: true,
            message: 'Producto registrado exitosamente en la tienda',
            product: data[0]
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al registrar el producto', error: error.message });
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
    deleteProduct
};
