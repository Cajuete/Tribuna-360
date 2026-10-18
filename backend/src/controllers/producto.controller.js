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
        const tenant_id = req.user.tenant_id; 

        const { data, error } = await supabase
            .from('products')
            .insert([{ tenant_id, name, description, price, stock, image_url }])
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

module.exports = {
    getProducts,
    createProduct
};