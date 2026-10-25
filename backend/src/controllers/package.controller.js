const { supabase } = require('../config/supabase');

const tenantFilter = (req, query) => {
    if (req.user.role === 'superadmin') {
        if (req.query.tenant_id) query = query.eq('tenant_id', req.query.tenant_id);
        return query;
    }
    return query.eq('tenant_id', req.user.tenant_id);
};

const getPackages = async (req, res) => {
    try {
        let query = supabase.from('packages').select('*, tenants(name)').order('created_at', { ascending: false });
        query = tenantFilter(req, query);
        if (req.query.active === 'true') query = query.eq('active', true);
        const { data, error } = await query;
        if (error) throw error;
        return res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al obtener paquetes', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const createPackage = async (req, res) => {
    try {
        const { name, description, price, items, active, tenant_id } = req.body;
        if (!name || price === undefined || price === null) {
            return res.status(400).json({ success: false, message: 'Nombre y precio son requeridos.' });
        }
        const tid = req.user.role === 'superadmin' ? (tenant_id || req.user.tenant_id) : req.user.tenant_id;
        if (!tid) return res.status(400).json({ success: false, message: 'tenant_id es requerido.' });

        const payload = {
            tenant_id: tid,
            name: String(name).trim(),
            description: description || null,
            price: Number(price),
            items: Array.isArray(items) ? items : [],
            active: active !== false
        };
        const { data, error } = await supabase.from('packages').insert([payload]).select('*, tenants(name)').single();
        if (error) throw error;
        return res.status(201).json({ success: true, message: 'Paquete creado.', data });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al crear el paquete', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const updatePackage = async (req, res) => {
    try {
        const { id } = req.params;
        const { data: existing, error: findError } = await supabase.from('packages').select('id, tenant_id').eq('id', id).single();
        if (findError || !existing) return res.status(404).json({ success: false, message: 'Paquete no encontrado.' });
        if (req.user.role !== 'superadmin' && existing.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({ success: false, message: 'Paquete de otro club.' });
        }
        const patch = {};
        const allowed = ['name', 'description', 'price', 'items', 'active'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) patch[key] = req.body[key];
        }
        const { data, error } = await supabase.from('packages').update(patch).eq('id', id).select('*, tenants(name)').single();
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Paquete actualizado.', data });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al actualizar el paquete', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const deletePackage = async (req, res) => {
    try {
        const { id } = req.params;
        const { data: existing, error: findError } = await supabase.from('packages').select('id, tenant_id').eq('id', id).single();
        if (findError || !existing) return res.status(404).json({ success: false, message: 'Paquete no encontrado.' });
        if (req.user.role !== 'superadmin' && existing.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({ success: false, message: 'Paquete de otro club.' });
        }
        const { error } = await supabase.from('packages').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Paquete eliminado.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al eliminar el paquete', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

module.exports = { getPackages, createPackage, updatePackage, deletePackage };