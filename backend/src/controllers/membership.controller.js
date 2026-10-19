const { supabase } = require('../config/supabase');

const getPlans = async (req, res) => {
    try {
        let query = supabase
            .from('membership_plans')
            .select('*, tenants(name, slug)')
            .order('price', { ascending: true });

        if (req.query.tenant_id) {
            query = query.eq('tenant_id', req.query.tenant_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los planes', error: error.message });
    }
};

const subscribe = async (req, res) => {
    try {
        const { plan_id } = req.body;
        const user_id = req.user.id;

        if (!plan_id) {
            return res.status(400).json({ status: 'error', message: 'Datos inválidos: se requiere el plan.' });
        }

        const { data: plan, error: planError } = await supabase
            .from('membership_plans')
            .select('id, tenant_id, name, price')
            .eq('id', plan_id)
            .single();

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

        const { data, error } = await supabase
            .from('memberships')
            .insert([{ plan_id, tenant_id: plan.tenant_id, user_id, status: 'active' }])
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({
            status: 'success',
            message: `¡Bienvenido al club! Ahora eres ${plan.name} (pago simulado).`,
            data
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al procesar la suscripción', error: error.message });
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
        return res.status(500).json({ status: 'error', message: 'Error al obtener tus membresías', error: error.message });
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
        return res.status(500).json({ status: 'error', message: 'Error al cancelar la membresía', error: error.message });
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
        return res.status(500).json({ status: 'error', message: 'Error al obtener las membresías', error: error.message });
    }
};

const canManageTenant = (req, tenantId) => {
    if (req.user.role === 'superadmin') return true;
    return req.user.tenant_id === tenantId;
};

const createPlan = async (req, res) => {
    try {
        const { name, price, benefits } = req.body;
        let tenant_id = req.body.tenant_id;

        if (req.user.role !== 'superadmin') {
            tenant_id = req.user.tenant_id;
        }

        const priceNum = Number(price);
        if (!tenant_id || !name || !Number.isFinite(priceNum) || priceNum < 0) {
            return res.status(400).json({ status: 'error', message: 'Datos inválidos: club, nombre y precio (>=0) son requeridos.' });
        }

        const { data, error } = await supabase
            .from('membership_plans')
            .insert([{ tenant_id, name, price: priceNum, benefits: benefits || null }])
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({ status: 'success', message: `Plan "${name}" creado.`, data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al crear el plan', error: error.message });
    }
};

const updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, benefits } = req.body;

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
        if (name) patch.name = name;
        if (price !== undefined) {
            const n = Number(price);
            if (!Number.isFinite(n) || n < 0) return res.status(400).json({ status: 'error', message: 'Precio inválido.' });
            patch.price = n;
        }
        if (benefits !== undefined) patch.benefits = benefits;
        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ status: 'error', message: 'No se envió ningún campo para actualizar.' });
        }

        const { data, error } = await supabase
            .from('membership_plans')
            .update(patch)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({ status: 'success', message: 'Plan actualizado.', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al actualizar el plan', error: error.message });
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
        return res.status(500).json({ status: 'error', message: 'Error al eliminar el plan', error: error.message });
    }
};

module.exports = {
    getPlans,
    subscribe,
    getMyMemberships,
    cancelMembership,
    getMemberships,
    createPlan,
    updatePlan,
    deletePlan
};
