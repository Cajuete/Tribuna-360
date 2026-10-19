const { supabase } = require('../config/supabase');

const getTenants = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tenants')
            .select('id, name, slug, logo_url, stadium_name, stadium_capacity, department, personeria, run_code, created_at, associations(code, name)')
            .order('name', { ascending: true });

        if (error) throw error;

        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los clubes', error: error.message });
    }
};

const createTenant = async (req, res) => {
    try {
        const { name, slug } = req.body;

        if (!name || !slug) {
            return res.status(400).json({ status: 'error', message: 'Datos inválidos: se requiere nombre y slug.' });
        }

        const { data: existing } = await supabase
            .from('tenants')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();

        if (existing) {
            return res.status(409).json({ status: 'error', message: 'Ya existe un club con ese slug.' });
        }

        const { data, error } = await supabase
            .from('tenants')
            .insert([{ name, slug }])
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({ status: 'success', message: `Club "${name}" creado.`, data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al crear el club', error: error.message });
    }
};

const updateTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, slug } = req.body;

        if (!name && !slug) {
            return res.status(400).json({ status: 'error', message: 'Datos inválidos: envía nombre o slug.' });
        }

        const patch = {};
        if (name) patch.name = name;
        if (slug) patch.slug = slug;

        const { data, error } = await supabase
            .from('tenants')
            .update(patch)
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ status: 'error', message: 'Club no encontrado.' });
        }

        return res.status(200).json({ status: 'success', message: 'Club actualizado.', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al actualizar el club', error: error.message });
    }
};

module.exports = {
    getTenants,
    createTenant,
    updateTenant
};
