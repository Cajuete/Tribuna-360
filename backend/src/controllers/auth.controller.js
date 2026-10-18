import { supabase } from '../config/supabase.js';
export const checkAuthStatus = async (req, res) => {
    try {
        const { data, error } = await supabase.from('tenants').select('count');
        
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
            data
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            error: err.message
        });
    }
};