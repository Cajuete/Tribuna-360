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
                details: error.message
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
            error: err.message
        });
    }
};

const register = async (req, res) => {
    try {
        const { email, password, full_name } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({
                status: 'error',
                message: 'Email, contraseña y nombre completo son obligatorios.'
            });
        }

        if (String(password).length < 6) {
            return res.status(400).json({
                status: 'error',
                message: 'La contraseña debe tener al menos 6 caracteres.'
            });
        }

        const { data: created, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name }
        });

        if (createError) {
            return res.status(400).json({
                status: 'error',
                message: createError.message.includes('already registered')
                    ? 'Ya existe una cuenta con ese email.'
                    : 'No se pudo crear la cuenta: ' + createError.message
            });
        }

        const { error: dbError } = await supabase
            .from('users')
            .insert([{
                auth_user_id: created.user.id,
                email,
                full_name,
                role: 'fan',
                tenant_id: null
            }]);

        if (dbError) {
            await supabase.auth.admin.deleteUser(created.user.id).catch(() => {});
            return res.status(500).json({
                status: 'error',
                message: 'No se pudo registrar el perfil del usuario.',
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
            error: err.message
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
            error: err.message
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

module.exports = { checkAuthStatus, register, login, me };
