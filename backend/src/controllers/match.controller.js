const { supabase } = require('../config/supabase');
const getMatches = async (req, res) => {
    try {
        const { tenant_id } = req.query; 

        let query = supabase.from('matches').select('*, tenants(name, slug)');

        if (tenant_id) {
            query = query.eq('tenant_id', tenant_id);
        }

        const { data, error } = await query.order('match_date', { ascending: true });

        if (error) {
            return res.status(400).json({ status: 'error', message: error.message });
        }

        res.status(200).json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: err.message });
    }
};
const createMatch = async (req, res) => {
    try {
        const { opponent, match_date, stadium_name } = req.body;
        let tenant_id = req.body.tenant_id;

        if (req.user.role === 'club_admin') {
            tenant_id = req.user.tenant_id;
        }

        if (!tenant_id || !opponent || !match_date || !stadium_name) {
            return res.status(400).json({ status: 'error', message: 'Faltan campos obligatorios para programar el partido.' });
        }

        const { data, error } = await supabase
            .from('matches')
            .insert([{ tenant_id, opponent, match_date, stadium_name, status: 'scheduled' }])
            .select();

        if (error) {
            return res.status(400).json({ status: 'error', message: error.message });
        }

        res.status(201).json({ status: 'success', message: 'Partido programado exitosamente', data: data[0] });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: err.message });
    }
};
const updateMatch = async (req, res) => {
    try {
        const { id } = req.params;
        const { match_date, stadium_name, status } = req.body;

        // Validación defensiva del ID
        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Se requiere el identificador del partido para la actualización.'
            });
        }

        const { data: existing } = await supabase
            .from('matches')
            .select('id, tenant_id')
            .eq('id', id)
            .maybeSingle();

        if (!existing) {
            return res.status(404).json({
                status: 'error',
                message: 'El partido especificado no existe o no pudo ser encontrado.'
            });
        }

        if (req.user.role !== 'superadmin' && existing.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({
                status: 'error',
                message: 'Este partido pertenece a otro club.'
            });
        }

        const { data, error } = await supabase
            .from('matches')
            .update({ match_date, stadium_name, status })
            .eq('id', id)
            .select();

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Error al actualizar el partido en la base de datos.',
                detail: error.message
            });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'El partido especificado no existe o no pudo ser encontrado.'
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Partido actualizado exitosamente.',
            data: data[0]
        });

    } catch (err) {
        return res.status(500).json({
            status: 'error',
            message: 'Error interno en el servidor al procesar la actualización.',
            error: err.message
        });
    }
};

const deleteMatch = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Se requiere el identificador del partido para la eliminación.'
            });
        }

        const { data: existing } = await supabase
            .from('matches')
            .select('id, tenant_id')
            .eq('id', id)
            .maybeSingle();

        if (!existing) {
            return res.status(404).json({
                status: 'error',
                message: 'El partido a eliminar no fue encontrado.'
            });
        }

        if (req.user.role !== 'superadmin' && existing.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({
                status: 'error',
                message: 'Este partido pertenece a otro club.'
            });
        }

        const { data, error } = await supabase
            .from('matches')
            .delete()
            .eq('id', id)
            .select();

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'No se pudo eliminar el partido debido a restricciones de integridad.',
                detail: error.message
            });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'El partido a eliminar no fue encontrado.'
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Partido eliminado exitosamente del sistema.',
            data: data[0]
        });

    } catch (err) {
        return res.status(500).json({
            status: 'error',
            message: 'Error crítico en el servidor durante la eliminación.',
            error: err.message
        });
    }
};

const getMatchById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('matches')
            .select('*, tenants(name, slug)')
            .eq('id', id)
            .single();

        if (error || !data) {
            return res.status(404).json({ status: 'error', message: 'Partido no encontrado.' });
        }

        return res.status(200).json({ status: 'success', data });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: err.message });
    }
};

const getMatchZones = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('zones')
            .select('*')
            .eq('match_id', id)
            .order('price', { ascending: true });

        if (error) {
            return res.status(400).json({ status: 'error', message: error.message });
        }

        return res.status(200).json({ status: 'success', data });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: err.message });
    }
};

module.exports = {
    getMatches,
    createMatch,
    updateMatch,
    deleteMatch,
    getMatchById,
    getMatchZones
};