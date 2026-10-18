const { supabase } = require('../config/supabase');

const purchaseTicket = async (req, res) => {
    try {
        const { match_id, ticket_type, price } = req.body;
        const user_id = req.user.id; 

        const { data, error } = await supabase
            .from('tickets')
            .insert([
                { match_id, user_id, ticket_type, price, status: 'valid' }
            ])
            .select();

        if (error) throw error;

        return res.status(201).json({
            success: true,
            message: 'Entrada comprada exitosamente',
            data: data[0]
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al procesar la compra de la entrada',
            error: error.message
        });
    }
};

const scanTicket = async (req, res) => {
    try {
        const { ticket_code } = req.body;

        const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('id', ticket_code)
            .single();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                message: 'Entrada no encontrada o inválida'
            });
        }

        if (data.status === 'used') {
            return res.status(400).json({
                success: false,
                message: '¡Advertencia! Esta entrada ya fue utilizada.'
            });
        }
        await supabase
            .from('tickets')
            .update({ status: 'used' })
            .eq('id', ticket_code);

        return res.json({
            success: true,
            message: 'Acceso concedido. Entrada válida.',
            ticket: data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error en el servidor al escanear la entrada',
            error: error.message
        });
    }
};

module.exports = {
    purchaseTicket,
    scanTicket
};