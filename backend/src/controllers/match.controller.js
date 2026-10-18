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
        const { tenant_id, opponent, match_date, stadium_name } = req.body;

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

module.exports = {
    getMatches,
    createMatch,
    updateMatch, 
    deleteMatch
};