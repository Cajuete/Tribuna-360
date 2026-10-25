const { supabase, supabaseAuth } = require('../config/supabase');

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

const STAFF_ROLES = [
    'sales_manager',
    'box_office_cashier',
    'stadium_manager',
    'financial_auditor',
    'customer_support',
    'gate_operator'
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
        let query = supabase
            .from('users')
            .select('id, email, full_name, role, tenant_id, created_at, tenants(name)')
            .order('created_at', { ascending: true });

        if (req.user.role !== 'superadmin') {
            query = query.eq('tenant_id', req.user.tenant_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los usuarios', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const createUser = async (req, res) => {
    try {
        const isSuperadmin = req.user.role === 'superadmin';
        const { full_name, email, password } = req.body;
        let { role } = req.body;
        let tenant_id = req.body.tenant_id;

        const allowedRoles = isSuperadmin ? VALID_ROLES : STAFF_ROLES;

        if (!allowedRoles.includes(role)) {
            return res.status(403).json({
                status: 'error',
                message: `Rol no permitido. Valores: ${allowedRoles.join(', ')}`
            });
        }

        if (!full_name || !full_name.trim() || !email || !email.trim() || !password) {
            return res.status(400).json({ status: 'error', message: 'Nombre, email y contraseña son obligatorios.' });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({ status: 'error', message: 'El email no es válido.' });
        }

        if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
            return res.status(400).json({
                status: 'error',
                message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.'
            });
        }

        const needsTenant = ROLES_REQUIRING_TENANT.includes(role);

        if (!isSuperadmin) {
            tenant_id = req.user.tenant_id;
        }

        if (needsTenant && !tenant_id) {
            return res.status(400).json({ status: 'error', message: 'Este rol requiere asignar un club.' });
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

        const cleanEmail = email.trim().toLowerCase();
        const cleanName = full_name.trim();

        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle();

        if (existing) {
            return res.status(409).json({ status: 'error', message: 'Ya existe una cuenta con ese email.' });
        }

        const { data: created, error: createError } = await supabaseAuth.auth.admin.createUser({
            email: cleanEmail,
            password,
            email_confirm: true,
            user_metadata: { full_name: cleanName, role, tenant_id: needsTenant ? tenant_id : null }
        });

        if (createError) {
            const alreadyExists = createError.code === 'email_exists' ||
                /already (been )?registered|email_exists/i.test(createError.message || '');
            return res.status(alreadyExists ? 409 : 400).json({
                status: 'error',
                message: alreadyExists
                    ? 'Ya existe una cuenta con ese email.'
                    : 'No se pudo crear la cuenta: ' + createError.message
            });
        }

        const { data, error } = await supabase
            .from('users')
            .insert([{
                auth_user_id: created.user.id,
                email: cleanEmail,
                full_name: cleanName,
                role,
                tenant_id: needsTenant ? tenant_id : null
            }])
            .select('id, email, full_name, role, tenant_id, tenants(name)')
            .single();

        if (error) {
            await supabaseAuth.auth.admin.deleteUser(created.user.id).catch(() => {});
            throw error;
        }

        return res.status(201).json({
            status: 'success',
            message: `Usuario ${cleanEmail} creado como ${role}.`,
            data
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al crear el usuario', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const resetUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        const isSuperadmin = req.user.role === 'superadmin';

        if (!password || password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
            return res.status(400).json({
                status: 'error',
                message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.'
            });
        }

        const { data: target } = await supabase
            .from('users')
            .select('id, email, role, tenant_id, auth_user_id')
            .eq('id', id)
            .maybeSingle();

        if (!target) {
            return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
        }

        if (!isSuperadmin) {
            if (target.tenant_id !== req.user.tenant_id) {
                return res.status(403).json({ status: 'error', message: 'Ese usuario no pertenece a tu club.' });
            }
            if (!STAFF_ROLES.includes(target.role)) {
                return res.status(403).json({ status: 'error', message: 'Solo puedes restablecer contraseñas de personal de tu club.' });
            }
        }

        if (!target.auth_user_id) {
            return res.status(409).json({ status: 'error', message: 'La cuenta no tiene un usuario de autenticación asociado.' });
        }

        const { error } = await supabaseAuth.auth.admin.updateUserById(target.auth_user_id, { password });

        if (error) {
            if (/not found/i.test(error.message || '')) {
                return res.status(404).json({ status: 'error', message: 'La cuenta de autenticación no existe.' });
            }
            throw error;
        }

        return res.status(200).json({
            status: 'success',
            message: `Contraseña actualizada para ${target.email}.`
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al restablecer la contraseña', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const assignRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        const isSuperadmin = req.user.role === 'superadmin';

        if (!VALID_ROLES.includes(role)) {
            return res.status(400).json({ status: 'error', message: `Rol inválido. Valores: ${VALID_ROLES.join(', ')}` });
        }

        if (!isSuperadmin && !STAFF_ROLES.includes(role)) {
            return res.status(403).json({
                status: 'error',
                message: `Solo puedes asignar roles de personal: ${STAFF_ROLES.join(', ')}`
            });
        }

        const { data: target } = await supabase
            .from('users')
            .select('id, email, role, tenant_id')
            .eq('id', id)
            .maybeSingle();

        if (!target) {
            return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
        }

        let tenant_id = req.body.tenant_id;

        if (!isSuperadmin) {
            if (target.tenant_id !== req.user.tenant_id) {
                return res.status(403).json({ status: 'error', message: 'Ese usuario no pertenece a tu club.' });
            }
            if (['superadmin', 'club_admin'].includes(target.role)) {
                return res.status(403).json({ status: 'error', message: 'No puedes modificar a ese usuario.' });
            }
            tenant_id = req.user.tenant_id;
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
        return res.status(500).json({ status: 'error', message: 'Error al asignar el rol', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const getMe = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, full_name, first_name, paternal_last_name, maternal_last_name, phone, age, ci, ci_extension, role, tenant_id, created_at, tenants(name, slug)')
            .eq('id', req.user.id)
            .single();

        if (error || !data) {
            return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
        }
        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener tu perfil', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const updateMe = async (req, res) => {
    try {
        const {
            first_name,
            paternal_last_name,
            maternal_last_name,
            phone,
            age,
            ci,
            ci_extension,
        } = req.body;

        const patch = {};
        if (first_name !== undefined) patch.first_name = String(first_name).trim() || null;
        if (paternal_last_name !== undefined) patch.paternal_last_name = String(paternal_last_name).trim() || null;
        if (maternal_last_name !== undefined) patch.maternal_last_name = String(maternal_last_name).trim() || null;
        if (phone !== undefined) patch.phone = String(phone).trim() || null;
        if (age !== undefined) {
            const n = Number(age);
            if (!Number.isInteger(n) || n < 18 || n > 110) {
                return res.status(400).json({ status: 'error', message: 'La edad debe ser un entero entre 18 y 110.' });
            }
            patch.age = n;
        }
        if (ci !== undefined) {
            const clean = String(ci).replace(/[^0-9]/g, '');
            if (clean && !/^\d{6,10}$/.test(clean)) {
                return res.status(400).json({ status: 'error', message: 'El C.I. solo admite números (6 a 10 dígitos).' });
            }
            patch.ci = clean || null;
        }
        if (ci_extension !== undefined) patch.ci_extension = ci_extension || null;

        // Recompute full_name if name parts provided
        const { data: current } = await supabase
            .from('users')
            .select('first_name, paternal_last_name, maternal_last_name')
            .eq('id', req.user.id)
            .single();

        const merged = {
            first_name: patch.first_name !== undefined ? patch.first_name : current?.first_name,
            paternal_last_name: patch.paternal_last_name !== undefined ? patch.paternal_last_name : current?.paternal_last_name,
            maternal_last_name: patch.maternal_last_name !== undefined ? patch.maternal_last_name : current?.maternal_last_name,
        };
        const fullName = [merged.first_name, merged.paternal_last_name, merged.maternal_last_name].filter(Boolean).join(' ').trim();
        if (fullName) patch.full_name = fullName;

        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ status: 'error', message: 'No se envió ningún campo para actualizar.' });
        }

        const { data, error } = await supabase
            .from('users')
            .update(patch)
            .eq('id', req.user.id)
            .select('id, email, full_name, first_name, paternal_last_name, maternal_last_name, phone, age, ci, ci_extension, role, tenant_id, created_at, tenants(name, slug)')
            .single();

        if (error) {
            if (/duplicate|unique/i.test(error.message || '')) {
                return res.status(409).json({ status: 'error', message: 'Ya existe una cuenta con ese C.I.' });
            }
            throw error;
        }

        return res.status(200).json({ status: 'success', message: 'Perfil actualizado.', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al actualizar tu perfil', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};
module.exports = {
    getUsers,
    createUser,
    assignRole,
    resetUserPassword,
    getMe,
    updateMe
};
