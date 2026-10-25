const { supabase, supabaseAuth } = require('../config/supabase');

const checkAuthStatus = async (req, res) => {
    try {
        const { data, error, count } = await supabase
            .from('tenants')
            .select('id', { count: 'exact', head: true });

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Error al conectar con la base de datos multi-tenant',
                details: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message)
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Módulo de autenticación y conexión con Supabase activo',
            data: { tenants: count }
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : err.message)
        });
    }
};

const register = async (req, res) => {
    try {
        const body = req.body || {};
        const data = {
            first_name: String(body.first_name || '').trim(),
            paternal_last_name: String(body.paternal_last_name || '').trim(),
            maternal_last_name: String(body.maternal_last_name || '').trim(),
            email: String(body.email || '').trim().toLowerCase(),
            phone: String(body.phone || '').trim(),
            age: Number(body.age),
            ci: String(body.ci || '').trim(),
            ci_extension: String(body.ci_extension || '').trim().toUpperCase(),
        };
        const { password } = body;

        if (!data.first_name || !data.paternal_last_name || !data.maternal_last_name ||
            !data.email || !password || !data.phone || !body.age || !data.ci || !data.ci_extension) {
            return res.status(400).json({
                status: 'error',
                message: 'Todos los campos son obligatorios: nombre, apellidos, email, contraseña, teléfono, edad, C.I. y extensión.'
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            return res.status(400).json({
                status: 'error',
                message: 'El email no tiene un formato válido.'
            });
        }

        if (String(password).length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
            return res.status(400).json({
                status: 'error',
                message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.'
            });
        }

        if (!/^\+?[0-9][0-9\s-]{6,14}$/.test(data.phone)) {
            return res.status(400).json({
                status: 'error',
                message: 'El teléfono no es válido (ej: +591 71234567).'
            });
        }

        if (!Number.isInteger(data.age) || data.age < 18 || data.age > 110) {
            return res.status(400).json({
                status: 'error',
                message: 'Debes ser mayor de 18 años para registrarte.'
            });
        }

        if (!/^\d{6,10}$/.test(data.ci)) {
            return res.status(400).json({
                status: 'error',
                message: 'El C.I. debe contener solo números (ej: 12345678).'
            });
        }

        if (!/^(LP|SC|CB|OR|PT|CH|TJ|BN|PD)$/.test(data.ci_extension)) {
            return res.status(400).json({
                status: 'error',
                message: 'La extensión del C.I. no es válida (LP, SC, CB, OR, PT, CH, TJ, BN, PD).'
            });
        }

        const { data: ciUser } = await supabase
            .from('users')
            .select('id')
            .eq('ci', data.ci)
            .maybeSingle();

        if (ciUser) {
            return res.status(409).json({
                status: 'error',
                message: 'Ya existe una cuenta registrada con ese C.I.'
            });
        }

        const full_name = `${data.first_name} ${data.paternal_last_name} ${data.maternal_last_name}`;

        const { data: created, error: createError } = await supabase.auth.admin.createUser({
            email: data.email,
            password,
            email_confirm: true,
            user_metadata: { full_name, phone: data.phone }
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

        const { error: dbError } = await supabase
            .from('users')
            .insert([{
                auth_user_id: created.user.id,
                email: data.email,
                full_name,
                first_name: data.first_name,
                paternal_last_name: data.paternal_last_name,
                maternal_last_name: data.maternal_last_name,
                phone: data.phone,
                age: data.age,
                ci: data.ci,
                ci_extension: data.ci_extension,
                role: 'fan',
                tenant_id: null
            }]);

        if (dbError) {
            await supabase.auth.admin.deleteUser(created.user.id).catch(() => {});
            const duplicateCi = dbError.code === '23505' && /ci/i.test(dbError.message || '');
            return res.status(duplicateCi ? 409 : 500).json({
                status: 'error',
                message: duplicateCi
                    ? 'Ya existe una cuenta registrada con ese C.I.'
                    : 'No se pudo registrar el perfil del usuario.',
                details: dbError.message
            });
        }

        return res.status(201).json({
            status: 'success',
            message: 'Cuenta creada exitosamente. Ya puedes iniciar sesión.'
        });
    } catch (err) {
        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor al registrar.',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : err.message)
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Email y contraseña son obligatorios.'
            });
        }

        const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
            email,
            password
        });

        if (authError || !authData?.session) {
            return res.status(401).json({
                status: 'error',
                message: 'Credenciales inválidas.'
            });
        }

        const { data: dbUser, error: dbError } = await supabase
            .from('users')
            .select('id, email, full_name, role, tenant_id, created_at')
            .eq('auth_user_id', authData.user.id)
            .single();

        if (dbError || !dbUser) {
            return res.status(403).json({
                status: 'error',
                message: 'El usuario no está registrado en el sistema.'
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Sesión iniciada correctamente.',
            data: {
                token: authData.session.access_token,
                user: dbUser
            }
        });
    } catch (err) {
        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor al iniciar sesión.',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : err.message)
        });
    }
};

const me = async (req, res) => {
    const { id, email, full_name, role, tenant_id, created_at } = req.user;
    return res.status(200).json({
        status: 'success',
        data: { id, email, full_name, role, tenant_id, created_at }
    });
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !String(email).trim()) {
            return res.status(400).json({
                status: 'error',
                message: 'El email es obligatorio.'
            });
        }

        const redirect = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/restablecer`;

        const { error } = await supabaseAuth.auth.resetPasswordForEmail(
            String(email).trim(),
            { redirectTo: redirect }
        );

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'No se pudo enviar el correo de recuperación. Inténtalo de nuevo en unos minutos.',
                details: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message)
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Si existe una cuenta con ese email, recibirás un correo con las instrucciones para restablecer tu contraseña.'
        });
    } catch (err) {
        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor al solicitar la recuperación.',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : err.message)
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'El enlace de recuperación y la nueva contraseña son obligatorios.'
            });
        }

        if (String(password).length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
            return res.status(400).json({
                status: 'error',
                message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.'
            });
        }

        const { data: tokenData, error: tokenError } = await supabaseAuth.auth.getUser(token);

        if (tokenError || !tokenData?.user) {
            return res.status(400).json({
                status: 'error',
                message: 'El enlace de recuperación no es válido o ha expirado. Solicita uno nuevo.'
            });
        }

        const { error: updateError } = await supabase.auth.admin.updateUserById(
            tokenData.user.id,
            { password: String(password) }
        );

        if (updateError) {
            return res.status(400).json({
                status: 'error',
                message: 'No se pudo actualizar la contraseña: ' + updateError.message
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.'
        });
    } catch (err) {
        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor al restablecer la contraseña.',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : err.message)
        });
    }
};

module.exports = { checkAuthStatus, register, login, me, forgotPassword, resetPassword };
