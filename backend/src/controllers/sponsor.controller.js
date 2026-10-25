const { supabase } = require('../config/supabase');

const tenantFilter = (req, query) => {
    if (req.user.role === 'superadmin') {
        if (req.query.tenant_id) query = query.eq('tenant_id', req.query.tenant_id);
        return query;
    }
    return query.eq('tenant_id', req.user.tenant_id);
};

const getSponsors = async (req, res) => {
    try {
        let query = supabase.from('sponsors').select('*, tenants(name)').order('created_at', { ascending: false });
        query = tenantFilter(req, query);
        if (req.query.active === 'true') query = query.eq('active', true);
        if (req.query.position) query = query.eq('position', req.query.position);
        const { data, error } = await query;
        if (error) throw error;
        return res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al obtener patrocinadores', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const createSponsor = async (req, res) => {
    try {
        const { name, logo_url, link, position, active, tenant_id } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Nombre requerido.' });
        const tid = req.user.role === 'superadmin' ? (tenant_id || req.user.tenant_id) : req.user.tenant_id;
        if (!tid) return res.status(400).json({ success: false, message: 'tenant_id es requerido.' });

        const payload = {
            tenant_id: tid,
            name: String(name).trim(),
            logo_url: logo_url || null,
            link: link || null,
            position: position || 'home',
            active: active !== false
        };
        const { data, error } = await supabase.from('sponsors').insert([payload]).select('*, tenants(name)').single();
        if (error) throw error;
        return res.status(201).json({ success: true, message: 'Patrocinador creado.', data });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al crear el patrocinador', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const updateSponsor = async (req, res) => {
    try {
        const { id } = req.params;
        const { data: existing, error: findError } = await supabase.from('sponsors').select('id, tenant_id').eq('id', id).single();
        if (findError || !existing) return res.status(404).json({ success: false, message: 'Patrocinador no encontrado.' });
        if (req.user.role !== 'superadmin' && existing.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({ success: false, message: 'Patrocinador de otro club.' });
        }
        const patch = {};
        const allowed = ['name', 'logo_url', 'link', 'position', 'active'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) patch[key] = req.body[key];
        }
        const { data, error } = await supabase.from('sponsors').update(patch).eq('id', id).select('*, tenants(name)').single();
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Patrocinador actualizado.', data });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al actualizar el patrocinador', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const deleteSponsor = async (req, res) => {
    try {
        const { id } = req.params;
        const { data: existing, error: findError } = await supabase.from('sponsors').select('id, tenant_id').eq('id', id).single();
        if (findError || !existing) return res.status(404).json({ success: false, message: 'Patrocinador no encontrado.' });
        if (req.user.role !== 'superadmin' && existing.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({ success: false, message: 'Patrocinador de otro club.' });
        }
        const { error } = await supabase.from('sponsors').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Patrocinador eliminado.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al eliminar el patrocinador', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

module.exports = { getSponsors, createSponsor, updateSponsor, deleteSponsor };