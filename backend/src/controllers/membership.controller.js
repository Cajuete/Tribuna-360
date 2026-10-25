const { supabase } = require('../config/supabase');

const DEFAULT_PLAN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const MISSING_DURATION_MSG = 'Falta aplicar la migracion 006_membership_details.sql (duracion del plan y vencimiento de membresias).';

const isMissingColumn = (error) =>
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    /column .* does not exist|could not find the '.*' column/i.test(error?.message || '');

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const parseDuration = (value) => {
    if (value === undefined || value === null || value === '') return DEFAULT_PLAN_DAYS;
    const days = Number.parseInt(value, 10);
    return Number.isInteger(days) && days > 0 && days <= 3650 ? days : null;
};

const getPlans = async (req, res) => {
    try {
        let query = supabase
            .from('membership_plans')
            .select('*, tenants(name, slug)')
            .order('price', { ascending: true });

        const STAFF_ROLES = ['club_admin', 'sales_manager', 'stadium_manager', 'financial_auditor', 'customer_support'];

        if (req.user && req.user.tenant_id && STAFF_ROLES.includes(req.user.role)) {
            query = query.eq('tenant_id', req.user.tenant_id);
        } else if (req.query.tenant_id) {
            query = query.eq('tenant_id', req.query.tenant_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los planes', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const subscribe = async (req, res) => {
    try {
        const { plan_id } = req.body;
        const user_id = req.user.id;

        if (!plan_id) {
            return res.status(400).json({ status: 'error', message: 'Datos inválidos: se requiere el plan.' });
        }

        let plan = null;
        let planError = null;

        ({ data: plan, error: planError } = await supabase
            .from('membership_plans')
            .select('id, tenant_id, name, price, duration_days')
            .eq('id', plan_id)
            .single());

        if (planError && isMissingColumn(planError)) {
            ({ data: plan, error: planError } = await supabase
                .from('membership_plans')
                .select('id, tenant_id, name, price')
                .eq('id', plan_id)
                .single());
        }

        if (planError || !plan) {
            return res.status(404).json({ status: 'error', message: 'Plan no encontrado.' });
        }

        const { data: existing } = await supabase
            .from('memberships')
            .select('id')
            .eq('user_id', user_id)
            .eq('tenant_id', plan.tenant_id)
            .eq('status', 'active')
            .maybeSingle();

        if (existing) {
            return res.status(409).json({ status: 'error', message: 'Ya eres socio activo de este club. Cancela tu membresía actual antes de cambiar de plan.' });
        }

        const durationDays = Number(plan.duration_days) > 0 ? Number(plan.duration_days) : DEFAULT_PLAN_DAYS;
        const expires_at = addDays(new Date(), durationDays).toISOString();
        const baseMembership = { plan_id, tenant_id: plan.tenant_id, user_id, status: 'active' };

        let data = null;
        let error = null;

        ({ data, error } = await supabase
            .from('memberships')
            .insert([{ ...baseMembership, expires_at }])
            .select()
            .single());

        if (error && isMissingColumn(error)) {
            ({ data, error } = await supabase
                .from('memberships')
                .insert([baseMembership])
                .select()
                .single());
        }

        if (error) throw error;

        return res.status(201).json({
            status: 'success',
            message: `��Bienvenido al club! Ahora eres ${plan.name} por ${durationDays} dias (pago simulado).`,
            data
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al procesar la suscripción', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const getMyMemberships = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('memberships')
            .select('*, membership_plans(name, price, benefits), tenants(name, slug)')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener tus membresías', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const cancelMembership = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: membership, error: membershipError } = await supabase
            .from('memberships')
            .select('*, membership_plans(name), tenants(name)')
            .eq('id', id)
            .single();

        if (membershipError || !membership) {
            return res.status(404).json({ status: 'error', message: 'Membresía no encontrada.' });
        }

        const isSuperadmin = req.user.role === 'superadmin';
        const isAdmin = ['superadmin', 'club_admin'].includes(req.user.role);
        if (membership.user_id !== req.user.id && !isAdmin) {
            return res.status(403).json({ status: 'error', message: 'No puedes cancelar una membresía que no es tuya.' });
        }
        if (membership.user_id !== req.user.id && isAdmin && !isSuperadmin && membership.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({ status: 'error', message: 'Membresía de otro club.' });
        }

        if (membership.status !== 'active') {
            return res.status(400).json({ status: 'error', message: 'Esta membresía ya no está activa.' });
        }

        const { data, error } = await supabase
            .from('memberships')
            .update({ status: 'cancelled' })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({
            status: 'success',
            message: `Membresía ${membership.membership_plans.name} de ${membership.tenants.name} cancelada.`,
            data
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al cancelar la membresía', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const renewMembership = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: membership, error: membershipError } = await supabase
            .from('memberships')
            .select('*, membership_plans(name, price), tenants(name)')
            .eq('id', id)
            .single();

        if (membershipError || !membership) {
            return res.status(404).json({ status: 'error', message: 'Membresia no encontrada.' });
        }

        if (!canManageTenant(req, membership.tenant_id)) {
            return res.status(403).json({ status: 'error', message: 'Membresia de otro club.' });
        }

        let durationDays = DEFAULT_PLAN_DAYS;
        const { data: plan, error: planError } = await supabase
            .from('membership_plans')
            .select('duration_days')
            .eq('id', membership.plan_id)
            .maybeSingle();

        if (planError && !isMissingColumn(planError)) throw planError;
        if (plan?.duration_days) durationDays = Number(plan.duration_days) || DEFAULT_PLAN_DAYS;

        const now = new Date();
        const currentExpiry = membership.expires_at ? new Date(membership.expires_at) : null;
        const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
        const expires_at = addDays(baseDate, durationDays).toISOString();

        const { data, error } = await supabase
            .from('memberships')
            .update({ status: 'active', expires_at })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (isMissingColumn(error)) {
                return res.status(400).json({ status: 'error', message: MISSING_DURATION_MSG });
            }
            throw error;
        }

        return res.status(200).json({
            status: 'success',
            message: `Membresia ${membership.membership_plans?.name || ''} renovada por ${durationDays} dias (hasta ${expires_at.slice(0, 10)}).`,
            data
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al renovar la membresia', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const getMemberships = async (req, res) => {
    try {
        let query = supabase
            .from('memberships')
            .select('*, users(email, full_name), membership_plans(name, price), tenants(name)')
            .order('created_at', { ascending: false });

        if (req.user.role !== 'superadmin') {
            query = query.eq('tenant_id', req.user.tenant_id);
        }
        if (req.query.status) {
            query = query.eq('status', req.query.status);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener las membresías', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const canManageTenant = (req, tenantId) => {
    if (req.user.role === 'superadmin') return true;
    return req.user.tenant_id === tenantId;
};

const createPlan = async (req, res) => {
    try {
        const { name, price, benefits, duration_days } = req.body;
        let tenant_id = req.body.tenant_id;

        if (req.user.role !== 'superadmin') {
            tenant_id = req.user.tenant_id;
        }

        const priceNum = Number(price);
        const durationDays = parseDuration(duration_days);
        const cleanName = String(name || '').trim();

        if (!tenant_id || !cleanName || !Number.isFinite(priceNum) || priceNum < 0 || durationDays === null) {
            return res.status(400).json({ status: 'error', message: 'Datos invalidos: club, nombre, precio (>=0) y duracion en dias (1-3650) son requeridos.' });
        }

        const { data, error } = await supabase
            .from('membership_plans')
            .insert([{
                tenant_id,
                name: cleanName,
                price: priceNum,
                benefits: benefits ? String(benefits).trim() : null,
                duration_days: durationDays
            }])
            .select()
            .single();

        if (error) {
            if (isMissingColumn(error)) {
                return res.status(400).json({ status: 'error', message: MISSING_DURATION_MSG });
            }
            throw error;
        }

        return res.status(201).json({ status: 'success', message: `Plan "${cleanName}" creado.`, data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al crear el plan', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, benefits, duration_days } = req.body;

        const { data: plan } = await supabase
            .from('membership_plans')
            .select('id, tenant_id')
            .eq('id', id)
            .maybeSingle();

        if (!plan) return res.status(404).json({ status: 'error', message: 'Plan no encontrado.' });
        if (!canManageTenant(req, plan.tenant_id)) {
            return res.status(403).json({ status: 'error', message: 'Plan de otro club.' });
        }

        const patch = {};
        if (name !== undefined) {
            const cleanName = String(name).trim();
            if (!cleanName) return res.status(400).json({ status: 'error', message: 'El nombre del plan no puede estar vacio.' });
            patch.name = cleanName;
        }
        if (price !== undefined) {
            const n = Number(price);
            if (!Number.isFinite(n) || n < 0) return res.status(400).json({ status: 'error', message: 'Precio invalido.' });
            patch.price = n;
        }
        if (duration_days !== undefined) {
            const durationDays = parseDuration(duration_days);
            if (durationDays === null) return res.status(400).json({ status: 'error', message: 'La duracion debe estar entre 1 y 3650 dias.' });
            patch.duration_days = durationDays;
        }
        if (benefits !== undefined) patch.benefits = benefits ? String(benefits).trim() : null;
        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ status: 'error', message: 'No se envio ningun campo para actualizar.' });
        }

        const { data, error } = await supabase
            .from('membership_plans')
            .update(patch)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (isMissingColumn(error)) {
                return res.status(400).json({ status: 'error', message: MISSING_DURATION_MSG });
            }
            throw error;
        }

        return res.status(200).json({ status: 'success', message: 'Plan actualizado.', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al actualizar el plan', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const deletePlan = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: plan } = await supabase
            .from('membership_plans')
            .select('id, tenant_id, name')
            .eq('id', id)
            .maybeSingle();

        if (!plan) return res.status(404).json({ status: 'error', message: 'Plan no encontrado.' });
        if (!canManageTenant(req, plan.tenant_id)) {
            return res.status(403).json({ status: 'error', message: 'Plan de otro club.' });
        }

        const { count } = await supabase
            .from('memberships')
            .select('id', { count: 'exact', head: true })
            .eq('plan_id', id);

        if (count > 0) {
            return res.status(409).json({
                status: 'error',
                message: `No se puede eliminar "${plan.name}": ${count} socio(s) lo tienen activo.`
            });
        }

        const { error } = await supabase.from('membership_plans').delete().eq('id', id);
        if (error) throw error;

        return res.status(200).json({ status: 'success', message: `Plan "${plan.name}" eliminado.` });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al eliminar el plan', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

module.exports = {
    getPlans,
    subscribe,
    getMyMemberships,
    cancelMembership,
    renewMembership,
    getMemberships,
    createPlan,
    updatePlan,
    deletePlan
};
