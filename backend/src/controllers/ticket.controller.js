const crypto = require('crypto');
const { supabase } = require('../config/supabase');

const generateQrCode = () =>
    'TRIBUNA360-' + crypto.randomBytes(8).toString('hex').toUpperCase();

const purchaseTicket = async (req, res) => {
    try {
        const { match_id, zone_id, quantity, buyer_ci, buyer_name, payment_method } = req.body;
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

        const isCashier = req.user.role === 'box_office_cashier';

        const newTickets = Array.from({ length: qty }, () => ({
            match_id,
            zone_id,
            buyer_id,
            qr_code: generateQrCode(),
            price: zone.price,
            status: 'valid',
            buyer_ci: buyer_ci ? String(buyer_ci).trim() : null,
            buyer_name: buyer_name ? String(buyer_name).trim() : null,
            payment_method: payment_method || 'efectivo',
            sold_by_cashier: isCashier ? req.user.id : null,
        }));

        const { data, error } = await supabase
            .from('tickets')
            .insert(newTickets)
            .select();

        if (error) throw error;

        return res.status(201).json({
            success: true,
            message: `${qty} entrada(s) emitida(s) exitosamente por taquilla.`,
            data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al procesar la emisión de la entrada',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message)
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
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message)
        });
    }
};

const getTickets = async (req, res) => {
    try {
        const isSuperadmin = req.user.role === 'superadmin';
        const tenantId = isSuperadmin ? (req.query.tenant_id || null) : req.user.tenant_id;

        let query = supabase
            .from('tickets')
            .select('id, price, status, created_at, scanned_at, match_id, zone_id, buyer_ci, buyer_name, payment_method, sold_by_cashier, matches(opponent, match_date, stadium_name, status), zones(name)')
            .order('created_at', { ascending: false });

        if (req.query.match_id) {
            query = query.eq('match_id', req.query.match_id);
        }

        if (tenantId) {
            const { data: matches, error: matchError } = await supabase
                .from('matches')
                .select('id')
                .eq('tenant_id', tenantId);

            if (matchError) throw matchError;

            const matchIds = (matches || []).map(m => m.id);
            if (matchIds.length === 0) {
                return res.status(200).json({ success: true, data: [] });
            }

            query = query.in('match_id', matchIds);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al obtener las entradas del club',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message)
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
            .select('*, zones(name), matches(opponent, stadium_name)')
            .eq('qr_code', qr_code)
            .single();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                message: 'Boleto inválido: Código QR no encontrado en el sistema.'
            });
        }

        if (data.status === 'used') {
            const scannedTime = data.scanned_at ? new Date(data.scanned_at).toLocaleTimeString('es-BO') : 'anteriormente';
            return res.status(400).json({
                success: false,
                message: `Boleto ya utilizado. Ingresó a las ${scannedTime}.`
            });
        }

        const { data: updated, error: updateError } = await supabase
            .from('tickets')
            .update({ status: 'used', scanned_at: new Date() })
            .eq('id', data.id)
            .select('*, zones(name), matches(opponent, stadium_name)')
            .single();

        if (updateError) throw updateError;

        return res.json({
            success: true,
            message: `Acceso Permitido — Zona: ${updated.zones?.name || 'General'}`,
            ticket: updated
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error en el servidor al validar el boleto',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message)
        });
    }
};

const supportSearchTickets = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || !q.trim()) {
            return res.status(400).json({ success: false, message: 'Ingrese un término de búsqueda (CI o correo).' });
        }
        const term = q.trim().toLowerCase();

        const { data: users, error: userError } = await supabase
            .from('users')
            .select('id')
            .or(`email.ilike.%${term}%,ci.ilike.%${term}%`);

        if (userError) throw userError;

        const userIds = (users || []).map(u => u.id);

        let query = supabase
            .from('tickets')
            .select('*, matches(opponent, match_date, stadium_name), zones(name), users(email, full_name, ci)')
            .order('created_at', { ascending: false });

        if (userIds.length > 0) {
            query = query.or(`buyer_ci.ilike.%${term}%,buyer_name.ilike.%${term}%,buyer_id.in.(${userIds.join(',')})`);
        } else {
            query = query.or(`buyer_ci.ilike.%${term}%,buyer_name.ilike.%${term}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error en búsqueda de soporte', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const supportRegenerateTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const { data: oldTicket, error: fetchError } = await supabase
            .from('tickets')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !oldTicket) {
            return res.status(404).json({ success: false, message: 'Boleto no encontrado.' });
        }

        await supabase
            .from('tickets')
            .update({ status: 'cancelled' })
            .eq('id', id);

        const newTicketPayload = {
            match_id: oldTicket.match_id,
            zone_id: oldTicket.zone_id,
            buyer_id: oldTicket.buyer_id,
            qr_code: generateQrCode(),
            price: oldTicket.price,
            status: 'valid',
            buyer_ci: oldTicket.buyer_ci,
            buyer_name: oldTicket.buyer_name,
            payment_method: oldTicket.payment_method,
        };

        const { data: newTicket, error: insertError } = await supabase
            .from('tickets')
            .insert([newTicketPayload])
            .select('*, matches(opponent, match_date, stadium_name), zones(name)')
            .single();

        if (insertError) throw insertError;

        return res.status(201).json({
            success: true,
            message: `Boleto bloqueado por seguridad (${reason || 'Extravío/Robo'}) y nuevo QR de emergencia emitido exitosamente.`,
            data: newTicket
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al regenerar el boleto', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

module.exports = {
    purchaseTicket,
    getMyTickets,
    getTickets,
    scanTicket,
    supportSearchTickets,
    supportRegenerateTicket
};
