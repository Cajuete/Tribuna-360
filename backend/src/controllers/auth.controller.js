const { supabase, supabaseAuth, supabasePublicAuth } = require('../config/supabase');

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
            message: 'MÃ³dulo de autenticaciÃ³n y conexiÃ³n con Supabase activo',
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

        // El registro pÃºblico nunca asigna roles ni clubes.
        if (body.role !== undefined || body.tenant_id !== undefined) {
            return res.status(400).json({
                status: 'error',
                message: 'No se permite asignar roles ni clubes desde el registro pÃºblico.'
            });
        }

        if (!data.first_name || !data.paternal_last_name || !data.maternal_last_name ||
            !data.email || !password || !data.phone || !body.age || !data.ci || !data.ci_extension) {
            return res.status(400).json({
                status: 'error',
                message: 'Todos los campos son obligatorios: nombre, apellidos, email, contraseÃ±a, telÃ©fono, edad, C.I. y extensiÃ³n.'
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            return res.status(400).json({
                status: 'error',
                message: 'El email no tiene un formato vÃ¡lido.'
            });
        }

        if (String(password).length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
            return res.status(400).json({
                status: 'error',
                message: 'La contraseÃ±a debe tener al menos 8 caracteres, una mayÃºscula, una minÃºscula y un nÃºmero.'
            });
        }

        if (!/^\+?[0-9][0-9\s-]{6,14}$/.test(data.phone)) {
            return res.status(400).json({
                status: 'error',
                message: 'El telÃ©fono no es vÃ¡lido (ej: +591 71234567).'
            });
        }

        if (!Number.isInteger(data.age) || data.age < 18 || data.age > 110) {
            return res.status(400).json({
                status: 'error',
                message: 'Debes ser mayor de 18 aÃ±os para registrarte.'
            });
        }

        if (!/^\d{6,10}$/.test(data.ci)) {
            return res.status(400).json({
                status: 'error',
                message: 'El C.I. debe contener solo nÃºmeros (ej: 12345678).'
            });
        }

        if (!/^(LP|SC|CB|OR|PT|CH|TJ|BN|PD)$/.test(data.ci_extension)) {
            return res.status(400).json({
                status: 'error',
                message: 'La extensiÃ³n del C.I. no es vÃ¡lida (LP, SC, CB, OR, PT, CH, TJ, BN, PD).'
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

        const requireEmailVerification = process.env.EMAIL_VERIFICATION_REQUIRED === 'true';

        const { data: created, error: createError } = await supabase.auth.admin.createUser({
            email: data.email,
            password,
            email_confirm: !requireEmailVerification,
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
            message: requireEmailVerification
                ? 'Cuenta creada exitosamente. Revisa tu correo para verificar tu cuenta antes de iniciar sesion.'
                : 'Cuenta creada exitosamente. Ya puedes iniciar sesion.',
            data: {
                requires_verification: requireEmailVerification
            }
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
                message: 'Email y contraseÃ±a son obligatorios.'
            });
        }

        const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
            email,
            password
        });

        if (authError || !authData?.session) {
            return res.status(401).json({
                status: 'error',
                message: 'Credenciales invÃ¡lidas.'
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
                message: 'El usuario no estÃ¡ registrado en el sistema.'
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'SesiÃ³n iniciada correctamente.',
            data: {
                token: authData.session.access_token,
                user: dbUser
            }
        });
    } catch (err) {
        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor al iniciar sesiÃ³n.',
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
        const email = String(req.body?.email || '').trim().toLowerCase();

        if (!email) {
            return res.status(400).json({
                status: 'error',
                message: 'El email es obligatorio.'
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                status: 'error',
                message: 'El formato del email no es válido.'
            });
        }

        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173')
            .split(',')[0]
            .trim()
            .replace(/\/$/, '');
        const redirect = process.env.PASSWORD_RESET_REDIRECT_URL ||
            `${frontendUrl}/restablecer`;

        const { error } = await supabasePublicAuth.auth.resetPasswordForEmail(
            email,
            { redirectTo: redirect }
        );

        if (error) {
            console.error('[Auth] Supabase no pudo iniciar la recuperación de contraseña:', error.message);
            return res.status(503).json({
                status: 'error',
                message: 'No se pudo procesar la solicitud ahora. Inténtalo de nuevo más tarde.'
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Si existe una cuenta con ese email, recibirÃ¡s un correo con las instrucciones para restablecer tu contraseÃ±a.'
        });
    } catch (err) {
        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor al solicitar la recuperaciÃ³n.',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : err.message)
        });
    }
};

module.exports = { checkAuthStatus, register, login, me, forgotPassword };
