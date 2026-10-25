const { supabase } = require('../config/supabase');
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                status: 'error',
                message: 'Acceso no autorizado. Token no proporcionado o formato incorrecto.'
            });
        }

        const token = authHeader.split(' ')[1];

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                status: 'error',
                message: 'Token inválido o expirado.',
                details: error ? error.message : null
            });
        }
        const { data: dbUser, error: dbError } = await supabase
            .from('users')
            .select('*')
            .eq('auth_user_id', user.id)
            .single();

        if (dbError || !dbUser) {
            return res.status(403).json({
                status: 'error',
                message: 'El usuario autenticado no está registrado en la base de datos del sistema.'
            });
        }

        req.user = dbUser;
        next();
    } catch (err) {
        return res.status(500).json({
            status: 'error',
            message: 'Error interno en la autenticación.',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : err.message)
        });
    }
};

/**
 * Middleware para verificar si el usuario posee uno de los roles permitidos
 * @param {Array<string>} allowedRoles - Lista de roles autorizados (ej: ['superadmin', 'club_admin'])
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                status: 'error',
                message: 'Usuario no autenticado.'
            });
        }

        const userRole = req.user.role;

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                status: 'error',
                message: `Acceso denegado. El rol '${userRole}' no cuenta con los permisos necesarios para realizar esta acción.`
            });
        }

        next();
    };
};

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return next();
        }

        const { data: dbUser, error: dbError } = await supabase
            .from('users')
            .select('*')
            .eq('auth_user_id', user.id)
            .single();

        if (dbError || !dbUser) {
            return next();
        }

        req.user = dbUser;
        next();
    } catch (err) {
        return next();
    }
};

module.exports = {
    verifyToken,
    requireRole,
    optionalAuth
};
