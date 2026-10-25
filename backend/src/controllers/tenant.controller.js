const { supabase } = require('../config/supabase');

const getTenants = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tenants')
            .select('id, name, slug, logo_url, stadium_name, stadium_capacity, department, personeria, run_code, short_history, trophies_count, trophies_list, created_at, is_active, subscription_status, subscription_plan, activated_at, commission_rate, associations(code, name)')
            .order('name', { ascending: true });

        if (error) throw error;

        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los clubes', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const getTenantBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const { data, error } = await supabase
            .from('tenants')
            .select('id, name, slug, logo_url, stadium_name, stadium_capacity, department, personeria, run_code, short_history, trophies_count, trophies_list, created_at, is_active, subscription_status, subscription_plan, activated_at, commission_rate, associations(code, name)')
            .eq('slug', slug)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ status: 'error', message: 'Club no encontrado.' });
        }

        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener el club', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
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
        return res.status(500).json({ status: 'error', message: 'Error al crear el club', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const updateTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const isSuperadmin = req.user.role === 'superadmin';

        if (!isSuperadmin && req.user.tenant_id !== id) {
            return res.status(403).json({ status: 'error', message: 'Solo puedes editar tu propio club.' });
        }

        const { name, slug, logo_url, stadium_name, stadium_capacity, department, personeria, run_code, short_history, trophies_count, trophies_list, is_active, subscription_status, subscription_plan, commission_rate } = req.body;
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
        if (short_history !== undefined) patch.short_history = short_history ? String(short_history).trim() : null;
        if (trophies_list !== undefined) patch.trophies_list = trophies_list ? String(trophies_list).trim() : null;

        if (trophies_count !== undefined) {
            const count = Number(trophies_count);
            if (!Number.isInteger(count) || count < 0) {
                return res.status(400).json({ status: 'error', message: 'El número de trofeos debe ser un entero mayor o igual a 0.' });
            }
            patch.trophies_count = count;
        }

        if (stadium_capacity !== undefined) {
            const capacity = Number(stadium_capacity);
            if (!Number.isInteger(capacity) || capacity < 1) {
                return res.status(400).json({ status: 'error', message: 'La capacidad del estadio debe ser un entero mayor a 0.' });
            }
            patch.stadium_capacity = capacity;
        }

if (isSuperadmin) {
          if (is_active !== undefined) {
            patch.is_active = Boolean(is_active);
            if (patch.is_active) patch.activated_at = new Date().toISOString();
          }
          if (subscription_status !== undefined) {
            const status = String(subscription_status).trim();
            if (!['trial', 'active', 'suspended', 'cancelled'].includes(status)) {
              return res.status(400).json({ status: 'error', message: 'Estado de suscripción inválido.' });
            }
            patch.subscription_status = status;
          }
          if (subscription_plan !== undefined) {
            const plan = String(subscription_plan).trim();
            if (!plan) return res.status(400).json({ status: 'error', message: 'El plan no puede estar vacío.' });
            patch.subscription_plan = plan;
          }
          if (commission_rate !== undefined) {
            if (commission_rate === null || commission_rate === '') {
              patch.commission_rate = null;
            } else {
              const rate = Number(commission_rate);
              if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
                return res.status(400).json({ status: 'error', message: 'La comisión debe ser un número entre 0 y 100.' });
              }
              patch.commission_rate = rate;
            }
          }
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
        return res.status(500).json({ status: 'error', message: 'Error al actualizar el club', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

module.exports = {
    getTenants,
    getTenantBySlug,
    createTenant,
    updateTenant
};
