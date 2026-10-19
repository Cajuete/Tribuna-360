const { supabase } = require('../config/supabase');

const VALID_ROLES = [
    'superadmin',
    'club_admin',
    'sales_manager',
    'box_office_cashier',
    'stadium_manager',
    'financial_auditor',
    'customer_support',
    'gate_operator',
    'fan'
];

const ROLES_REQUIRING_TENANT = [
    'club_admin',
    'sales_manager',
    'box_office_cashier',
    'stadium_manager',
    'financial_auditor',
    'customer_support',
    'gate_operator'
];

const getUsers = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, full_name, role, tenant_id, created_at, tenants(name)')
            .order('created_at', { ascending: true });

        if (error) throw error;

        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los usuarios', error: error.message });
    }
};

const assignRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role, tenant_id } = req.body;

        if (!VALID_ROLES.includes(role)) {
            return res.status(400).json({ status: 'error', message: `Rol inválido. Valores: ${VALID_ROLES.join(', ')}` });
        }

        const needsTenant = ROLES_REQUIRING_TENANT.includes(role);

        if (needsTenant && !tenant_id) {
            return res.status(400).json({ status: 'error', message: 'Este rol requiere asignar un club (tenant_id).' });
        }

        if (tenant_id) {
            const { data: tenant } = await supabase
                .from('tenants')
                .select('id')
                .eq('id', tenant_id)
                .maybeSingle();

            if (!tenant) {
                return res.status(404).json({ status: 'error', message: 'El club indicado no existe.' });
            }
        }

        const { data, error } = await supabase
            .from('users')
            .update({ role, tenant_id: needsTenant ? tenant_id : null })
            .eq('id', id)
            .select('id, email, full_name, role, tenant_id')
            .single();

        if (error || !data) {
            return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
        }

        return res.status(200).json({
            status: 'success',
            message: `${data.email} ahora es ${role}${needsTenant ? ' del club asignado' : ''}.`,
            data
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al asignar el rol', error: error.message });
    }
};

module.exports = {
    getUsers,
    assignRole
};
