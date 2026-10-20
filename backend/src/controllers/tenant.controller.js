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

const getTenantBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const { data, error } = await supabase
            .from('tenants')
            .select('id, name, slug, logo_url, stadium_name, stadium_capacity, department, personeria, run_code, created_at, associations(code, name)')
            .eq('slug', slug)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ status: 'error', message: 'Club no encontrado.' });
        }

        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener el club', error: error.message });
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
        const isSuperadmin = req.user.role === 'superadmin';

        if (!isSuperadmin && req.user.tenant_id !== id) {
            return res.status(403).json({ status: 'error', message: 'Solo puedes editar tu propio club.' });
        }

        const { name, slug, logo_url, stadium_name, stadium_capacity, department, personeria, run_code } = req.body;
        const patch = {};

        if (name !== undefined) {
            const value = String(name).trim();
            if (!value) return res.status(400).json({ status: 'error', message: 'El nombre del club no puede estar vacío.' });
            patch.name = value;
        }

        if (slug !== undefined && isSuperadmin) {
            const value = String(slug).trim();
            if (!/^[a-z0-9-]+$/.test(value)) {
                return res.status(400).json({ status: 'error', message: 'Slug inválido: usa minúsculas, números y guiones.' });
            }
            patch.slug = value;
        }

        if (logo_url !== undefined) patch.logo_url = logo_url ? String(logo_url).trim() : null;
        if (stadium_name !== undefined) patch.stadium_name = stadium_name ? String(stadium_name).trim() : null;
        if (department !== undefined) patch.department = department ? String(department).trim() : null;
        if (personeria !== undefined) patch.personeria = personeria ? String(personeria).trim() : null;
        if (run_code !== undefined) patch.run_code = run_code ? String(run_code).trim() : null;

        if (stadium_capacity !== undefined) {
            const capacity = Number(stadium_capacity);
            if (!Number.isInteger(capacity) || capacity < 1) {
                return res.status(400).json({ status: 'error', message: 'La capacidad del estadio debe ser un entero mayor a 0.' });
            }
            patch.stadium_capacity = capacity;
        }

        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ status: 'error', message: 'No hay datos para actualizar.' });
        }

        const { data, error } = await supabase
            .from('tenants')
            .update(patch)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ status: 'error', message: 'Ya existe un club con ese slug.' });
            }
            throw error;
        }

        if (!data) {
            return res.status(404).json({ status: 'error', message: 'Club no encontrado.' });
        }

        return res.status(200).json({ status: 'success', message: 'Club actualizado.', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al actualizar el club', error: error.message });
    }
};

module.exports = {
    getTenants,
    getTenantBySlug,
    createTenant,
    updateTenant
};
