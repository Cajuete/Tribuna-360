const crypto = require('crypto');
const { supabase } = require('../config/supabase');

const generateQrCode = () =>
    'TRIBUNA360-' + crypto.randomBytes(8).toString('hex').toUpperCase();

const purchaseTicket = async (req, res) => {
    try {
        const { match_id, zone_id, quantity } = req.body;
        const buyer_id = req.user.id;
        const qty = Number.parseInt(quantity, 10);

        if (!match_id || !zone_id || !Number.isInteger(qty) || qty < 1 || qty > 10) {
            return res.status(400).json({
                success: false,
                message: 'Datos inválidos: se requiere partido, zona y cantidad (entre 1 y 10).'
            });
        }

        const { data: zone, error: zoneError } = await supabase
            .from('zones')
            .select('id, match_id, name, price, capacity')
            .eq('id', zone_id)
            .single();

        if (zoneError || !zone || zone.match_id !== match_id) {
            return res.status(404).json({
                success: false,
                message: 'La zona indicada no pertenece a este partido.'
            });
        }

        const { count: sold, error: countError } = await supabase
            .from('tickets')
            .select('id', { count: 'exact', head: true })
            .eq('zone_id', zone_id);

        if (countError) throw countError;

        const remaining = zone.capacity - sold;
        if (remaining < qty) {
            return res.status(409).json({
                success: false,
                message: `Aforo insuficiente en ${zone.name}: quedan ${Math.max(remaining, 0)} entrada(s).`
            });
        }

        const newTickets = Array.from({ length: qty }, () => ({
            match_id,
            zone_id,
            buyer_id,
            qr_code: generateQrCode(),
            price: zone.price,
            status: 'valid'
        }));

        const { data, error } = await supabase
            .from('tickets')
            .insert(newTickets)
            .select();

        if (error) throw error;

        return res.status(201).json({
            success: true,
            message: `${qty} entrada(s) comprada(s) exitosamente (pago simulado).`,
            data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al procesar la compra de la entrada',
            error: error.message
        });
    }
};

const getMyTickets = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tickets')
            .select('*, matches(opponent, match_date, stadium_name, status), zones(name)')
            .eq('buyer_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al obtener tus entradas',
            error: error.message
        });
    }
};

const scanTicket = async (req, res) => {
    try {
        const { qr_code } = req.body;

        if (!qr_code) {
            return res.status(400).json({
                success: false,
                message: 'Falta el código QR de la entrada'
            });
        }

        const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('qr_code', qr_code)
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

        const { data: updated, error: updateError } = await supabase
            .from('tickets')
            .update({ status: 'used', scanned_at: new Date() })
            .eq('id', data.id)
            .select()
            .single();

        if (updateError) throw updateError;

        return res.json({
            success: true,
            message: 'Acceso concedido. Entrada válida.',
            ticket: updated
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
    getMyTickets,
    scanTicket
};
