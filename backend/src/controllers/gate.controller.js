const { supabase } = require('../config/supabase');

const getStadiumGates = async (req, res) => {
    try {
        const { match_id } = req.query;
        let query = supabase.from('stadium_gates').select('*, matches(opponent, stadium_name), zones(name, capacity)');
        if (match_id) query = query.eq('match_id', match_id);

        const { data, error } = await query;
        if (error) throw error;

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al obtener estado de puertas', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const updateGateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, is_paused } = req.body;

        const patch = { updated_at: new Date() };
        if (status !== undefined) patch.status = status;
        if (is_paused !== undefined) patch.is_paused = is_paused;

        const { data, error } = await supabase
            .from('stadium_gates')
            .update(patch)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({ success: true, message: 'Estado de puerta actualizado.', data });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al actualizar puerta', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

module.exports = {
    getStadiumGates,
    updateGateStatus
};
