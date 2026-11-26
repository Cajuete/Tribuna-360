const { supabase } = require('../config/supabase');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BOLIVIA_DEPARTMENTS = [
    'Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro',
    'Pando', 'Potosí', 'Santa Cruz', 'Tarija',
];

const getTenants = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tenants')
            .select('id, name, slug, logo_url, stadium_name, stadium_capacity, department, delivery_home_fee, delivery_point_fee, delivery_interdepartment_surcharge, personeria, run_code, short_history, trophies_count, trophies_list, follower_count, created_at, is_active, subscription_status, subscription_plan, activated_at, commission_rate, associations(code, name)')
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
            .select('id, name, slug, logo_url, stadium_name, stadium_capacity, department, delivery_home_fee, delivery_point_fee, delivery_interdepartment_surcharge, personeria, run_code, short_history, trophies_count, trophies_list, follower_count, created_at, is_active, subscription_status, subscription_plan, activated_at, commission_rate, associations(code, name)')
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

const getDeliverySettings = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tenants')
            .select('id, name, department, delivery_home_fee, delivery_point_fee, delivery_interdepartment_surcharge')
            .eq('id', req.params.tenantId)
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ success: false, message: 'Club no encontrado.' });

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('[Tenants] No se pudo cargar la configuración de entrega:', error.message);
        return res.status(500).json({ success: false, message: 'No se pudo cargar la configuración de entrega.' });
    }
};

const getMyFollowedTenants = async (req, res) => {
    try {
        if (req.user?.role !== 'fan') {
            return res.status(200).json({ status: 'success', data: [] });
        }
        const { data, error } = await supabase
            .from('tenant_follows')
            .select('tenant_id')
            .eq('user_id', req.user.id);
        if (error) throw error;
        return res.status(200).json({ status: 'success', data: (data || []).map(row => row.tenant_id) });
    } catch (error) {
        console.error('[Tenants] No se pudieron obtener los clubes seguidos:', error.message);
        return res.status(500).json({ status: 'error', message: 'No se pudieron cargar los clubes que sigues.' });
    }
};

const followTenant = async (req, res) => {
    try {
        const tenantId = req.params.tenantId;
        if (!UUID_RE.test(tenantId)) {
            return res.status(400).json({ status: 'error', message: 'El identificador del club no es válido.' });
        }
        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('id')
            .eq('id', tenantId)
            .maybeSingle();
        if (tenantError) throw tenantError;
        if (!tenant) return res.status(404).json({ status: 'error', message: 'Club no encontrado.' });

        const { error } = await supabase
            .from('tenant_follows')
            .insert({ tenant_id: tenantId, user_id: req.user.id });
        if (error && error.code !== '23505') throw error;

        return res.status(200).json({
            status: 'success',
            data: await getTenantFollowResult(tenantId, true),
        });
    } catch (error) {
        console.error('[Tenants] No se pudo seguir el club:', error.message);
        return res.status(500).json({ status: 'error', message: 'No se pudo seguir este club.' });
    }
};

const unfollowTenant = async (req, res) => {
    try {
        const tenantId = req.params.tenantId;
        if (!UUID_RE.test(tenantId)) {
            return res.status(400).json({ status: 'error', message: 'El identificador del club no es válido.' });
        }
        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('id')
            .eq('id', tenantId)
            .maybeSingle();
        if (tenantError) throw tenantError;
        if (!tenant) return res.status(404).json({ status: 'error', message: 'Club no encontrado.' });

        const { error } = await supabase
            .from('tenant_follows')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('user_id', req.user.id);
        if (error) throw error;

        return res.status(200).json({
            status: 'success',
            data: await getTenantFollowResult(tenantId, false),
        });
    } catch (error) {
        console.error('[Tenants] No se pudo dejar de seguir el club:', error.message);
        return res.status(500).json({ status: 'error', message: 'No se pudo dejar de seguir este club.' });
    }
};

const getTenantFollowResult = async (tenantId, following) => {
    const { data, error } = await supabase
        .from('tenants')
        .select('follower_count')
        .eq('id', tenantId)
        .single();
    if (error) throw error;
    return { tenant_id: tenantId, following, follower_count: data.follower_count };
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

        const {
            name, slug, logo_url, stadium_name, stadium_capacity, department,
            delivery_home_fee, delivery_point_fee, delivery_interdepartment_surcharge,
            personeria, run_code, short_history, trophies_count, trophies_list,
            is_active, subscription_status, subscription_plan, commission_rate,
        } = req.body;
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
        if (department !== undefined) {
            const value = typeof department === 'string' ? department.trim() : '';
            if (!BOLIVIA_DEPARTMENTS.includes(value)) {
                return res.status(400).json({ status: 'error', message: 'Selecciona un departamento válido para el club.' });
            }
            patch.department = value;
        }
        for (const [field, value] of Object.entries({
            delivery_home_fee,
            delivery_point_fee,
            delivery_interdepartment_surcharge,
        })) {
            if (value === undefined) continue;
            const amount = Number(value);
            if (!Number.isInteger(amount) || amount < 0 || amount > 10000) {
                return res.status(400).json({ status: 'error', message: 'Las tarifas de entrega deben ser números enteros entre Bs 0 y Bs 10.000.' });
            }
            patch[field] = amount;
        }
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
    getDeliverySettings,
    getMyFollowedTenants,
    followTenant,
    unfollowTenant,
    createTenant,
    updateTenant
};
