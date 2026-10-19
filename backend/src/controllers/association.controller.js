const { supabase } = require('../config/supabase');

const getAssociations = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('associations')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener las asociaciones', error: error.message });
    }
};

module.exports = { getAssociations };
