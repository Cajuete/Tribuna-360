const { supabase } = require('../config/supabase');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SPONSOR_POSITIONS = ['home', 'tienda', 'checkout', 'partidos', 'sidebar'];

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

const getPublicSponsors = async (req, res) => {
    try {
        const { tenant_id: tenantId, position } = req.query;
        if (!UUID_RE.test(String(tenantId || ''))) {
            return res.status(400).json({ success: false, message: 'El club solicitado no es válido.' });
        }
        if (position && !SPONSOR_POSITIONS.includes(String(position))) {
            return res.status(400).json({ success: false, message: 'La ubicación solicitada no es válida.' });
        }

        let query = supabase.from('sponsors')
            .select('id, tenant_id, name, logo_url, link, position, tenants(name, slug)')
            .eq('tenant_id', tenantId)
            .eq('active', true)
            .order('created_at', { ascending: true });
        if (position) query = query.eq('position', position);

        const { data, error } = await query;
        if (error) throw error;
        return res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'No se pudieron cargar los patrocinadores del club.',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message,
        });
    }
};

const createSponsor = async (req, res) => {
    try {
        const { name, logo_url, link, position, active, tenant_id } = req.body;
        const cleanName = typeof name === 'string' ? name.trim() : '';
        const cleanLogo = typeof logo_url === 'string' ? logo_url.trim() : '';
        const cleanLink = typeof link === 'string' ? link.trim() : '';
        const urlPattern = /^https?:\/\/[^\s]+$/i;
        if (!cleanName || cleanName.length > 150 ||
            (cleanLogo && (!urlPattern.test(cleanLogo) || cleanLogo.length > 500)) ||
            (cleanLink && (!urlPattern.test(cleanLink) || cleanLink.length > 500)) ||
            (position !== undefined && !SPONSOR_POSITIONS.includes(position)) ||
            (active !== undefined && typeof active !== 'boolean')) {
            return res.status(400).json({ success: false, message: 'Nombre o URLs del patrocinador no son válidos.' });
        }
        const tid = req.user.role === 'superadmin' ? (tenant_id || req.user.tenant_id) : req.user.tenant_id;
        if (!tid) return res.status(400).json({ success: false, message: 'tenant_id es requerido.' });

        const payload = {
            tenant_id: tid,
            name: cleanName,
            logo_url: cleanLogo || null,
            link: cleanLink || null,
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
        if (patch.name !== undefined) {
            if (typeof patch.name !== 'string' || !patch.name.trim() || patch.name.trim().length > 150) {
                return res.status(400).json({ success: false, message: 'El nombre del patrocinador no es válido.' });
            }
            patch.name = patch.name.trim();
        }
        for (const key of ['logo_url', 'link']) {
            if (patch[key] !== undefined) {
                if (typeof patch[key] !== 'string' || (patch[key].trim() && !/^https?:\/\/[^\s]+$/i.test(patch[key].trim())) || patch[key].trim().length > 500) {
                    return res.status(400).json({ success: false, message: 'La URL del patrocinador no es válida.' });
                }
                patch[key] = patch[key].trim() || null;
            }
        }
        if (patch.position !== undefined && !SPONSOR_POSITIONS.includes(patch.position)) {
            return res.status(400).json({ success: false, message: 'La ubicación del patrocinador no es válida.' });
        }
        if (patch.active !== undefined && typeof patch.active !== 'boolean') {
            return res.status(400).json({ success: false, message: 'El estado del patrocinador no es válido.' });
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

module.exports = { getSponsors, getPublicSponsors, createSponsor, updateSponsor, deleteSponsor };