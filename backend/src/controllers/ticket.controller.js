const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const {
    isEnabled: isWaitingRoomEnabled,
    releasePurchaseAccess,
    verifyPurchaseAccess,
} = require('../services/virtualQueue.service');

const generateQrCode = () =>
    'TRIBUNA360-' + crypto.randomBytes(8).toString('hex').toUpperCase();

const purchaseTicket = async (req, res) => {
    let queueAdmission = null;
    try {
        const { match_id, zone_id, quantity, buyer_ci, buyer_name, payment_method, queue_token } = req.body;
        const buyer_id = req.user.id;
        const qty = Number.parseInt(quantity, 10);

        if (!match_id || !zone_id || !Number.isInteger(qty) || qty < 1 || qty > 10) {
            return res.status(400).json({
                success: false,
                message: 'Datos inválidos: se requiere partido, zona y cantidad (entre 1 y 10).'
            });
        }

        if (isWaitingRoomEnabled() && req.user.role !== 'box_office_cashier') {
            let queueAccess;
            try {
                queueAccess = await verifyPurchaseAccess({
                    token: queue_token,
                    matchId: match_id,
                    userId: String(buyer_id),
                });
            } catch (error) {
                console.error('[WaitingRoom] No se pudo validar la autorización de compra:', error.message);
                return res.status(503).json({
                    success: false,
                    message: 'La fila virtual no está configurada correctamente. Contacta al administrador.',
                });
            }
            if (!queueAccess.ok) {
                return res.status(403).json({ success: false, message: queueAccess.reason });
            }
            queueAdmission = { matchId: match_id, userId: String(buyer_id) };
        }

        const isCashier = req.user.role === 'box_office_cashier';

        const newTickets = Array.from({ length: qty }, () => ({
            qr_code: generateQrCode(),
            buyer_ci: buyer_ci ? String(buyer_ci).trim() : null,
            buyer_name: buyer_name ? String(buyer_name).trim() : null,
            payment_method: payment_method || 'efectivo',
            sold_by_cashier: isCashier ? req.user.id : null,
        }));

        const { data: sale, error } = await supabase.rpc('sell_zone_tickets', {
            p_match_id: match_id,
            p_zone_id: zone_id,
            p_buyer_id: buyer_id,
            p_tickets: newTickets,
        });

        if (error) {
            if (error.message.includes('ZONE_NOT_FOUND')) {
                return res.status(404).json({
                    success: false,
                    message: 'La zona indicada no pertenece a este partido.',
                });
            }
            if (error.message.includes('ZONE_DISABLED')) {
                return res.status(409).json({
                    success: false,
                    message: 'Esta zona no está habilitada para la venta.',
                });
            }
            if (error.message.includes('NUMBERED_ZONE_REQUIRES_SEAT_SELECTION')) {
                return res.status(409).json({
                    success: false,
                    message: 'Esta zona tiene butacas numeradas; la compra se habilitará cuando esté disponible la selección de asientos.',
                });
            }
            if (error.message.includes('INSUFFICIENT_CAPACITY')) {
                const remaining = Number.parseInt(error.details, 10);
                return res.status(409).json({
                    success: false,
                    message: `Aforo insuficiente en esta zona: quedan ${Number.isInteger(remaining) ? remaining : 0} entrada(s).`,
                });
            }
            throw error;
        }

        return res.status(201).json({
            success: true,
            message: `${qty} entrada(s) emitida(s) exitosamente por taquilla.`,
            data: sale.tickets,
            remaining: sale.remaining,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al procesar la emisión de la entrada',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message)
        });
    } finally {
        if (queueAdmission) {
            try {
                await releasePurchaseAccess(queueAdmission);
            } catch (error) {
                console.error('[WaitingRoom] No se pudo liberar el turno de compra:', error.message);
            }
        }
    }
};

const getMyTickets = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tickets')
            .select('*, matches(opponent, match_date, stadium_name, status), zones(name)')
            .eq('buyer_id', req.user.id)
            .in('status', ['valid', 'used'])
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
            .eq('status', 'valid')
            .select('*, zones(name), matches(opponent, stadium_name)')
            .maybeSingle();

        if (updateError) throw updateError;
        if (!updated) {
            return res.status(409).json({
                success: false,
                message: 'La entrada ya fue utilizada o dejó de estar habilitada.'
            });
        }

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

const getOfflineMatches = async (req, res) => {
    try {
        const tenantId = req.user.role === 'superadmin'
            ? req.query.tenant_id
            : req.user.tenant_id;

        if (!tenantId && req.user.role !== 'superadmin') {
            return res.status(400).json({
                success: false,
                message: 'Se requiere un club para preparar el escáner offline.'
            });
        }

        let query = supabase
            .from('matches')
            .select('id, opponent, match_date, stadium_name, status')
            .in('status', ['scheduled', 'live'])
            .order('match_date', { ascending: true });
        if (tenantId) query = query.eq('tenant_id', tenantId);

        const { data, error } = await query;
        if (error) throw error;

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al obtener los partidos para el escáner offline.',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message)
        });
    }
};

const getOfflineTicketManifest = async (req, res) => {
    try {
        const { match_id } = req.query;
        if (!match_id) {
            return res.status(400).json({ success: false, message: 'Se requiere el partido para descargar las entradas.' });
        }

        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('id, tenant_id, opponent, match_date, stadium_name, status')
            .eq('id', match_id)
            .maybeSingle();

        if (matchError) throw matchError;
        if (!match) {
            return res.status(404).json({ success: false, message: 'Partido no encontrado.' });
        }
        if (req.user.role !== 'superadmin' && match.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para preparar este partido.' });
        }
        if (!['scheduled', 'live'].includes(match.status)) {
            return res.status(409).json({ success: false, message: 'Solo se pueden preparar partidos programados o en curso.' });
        }

        const tickets = [];
        const pageSize = 1000;
        for (let offset = 0; ; offset += pageSize) {
            const { data, error } = await supabase
                .from('tickets')
                .select('id, match_id, zone_id, qr_code, status, zones(name)')
                .eq('match_id', match_id)
                .eq('status', 'valid')
                .order('id', { ascending: true })
                .range(offset, offset + pageSize - 1);

            if (error) throw error;
            tickets.push(...(data || []));
            if (!data || data.length < pageSize) break;
        }

        return res.status(200).json({
            success: true,
            data: { match, tickets, downloaded_at: new Date().toISOString() }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al preparar las entradas offline.',
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message)
        });
    }
};

const syncOfflineTicketScans = async (req, res) => {
    try {
        const { match_id, scans } = req.body;
        if (!match_id || !Array.isArray(scans) || scans.length < 1 || scans.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere un partido y entre 1 y 100 escaneos pendientes.'
            });
        }

        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('id, tenant_id')
            .eq('id', match_id)
            .maybeSingle();

        if (matchError) throw matchError;
        if (!match) {
            return res.status(404).json({ success: false, message: 'Partido no encontrado.' });
        }
        if (req.user.role !== 'superadmin' && match.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para sincronizar este partido.' });
        }

        const clientScanIds = new Set();
        const validScans = scans.every((scan) => {
            if (
                !scan ||
                typeof scan.client_scan_id !== 'string' ||
                scan.client_scan_id.length > 80 ||
                typeof scan.qr_code !== 'string' ||
                scan.qr_code.length < 1 ||
                scan.qr_code.length > 80 ||
                clientScanIds.has(scan.client_scan_id)
            ) {
                return false;
            }
            clientScanIds.add(scan.client_scan_id);
            return true;
        });

        if (!validScans) {
            return res.status(400).json({ success: false, message: 'La lista contiene escaneos inválidos o repetidos.' });
        }

        const { data, error } = await supabase.rpc('sync_offline_ticket_scans', {
            p_match_id: String(match_id),
            p_scanner_user_id: String(req.user.id),
            p_scans: scans.map(({ client_scan_id, qr_code }) => ({ client_scan_id, qr_code }))
        });

        if (error) throw error;

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al sincronizar los escaneos offline. Verifica que la migración 015_offline_ticket_scanning.sql esté aplicada.',
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

        const { data: newTicketId, error: regenerateError } = await supabase
            .rpc('regenerate_zone_ticket', {
                p_ticket_id: id,
                p_qr_code: generateQrCode(),
            });

        if (regenerateError) {
            if (regenerateError.message.includes('TICKET_NOT_FOUND')) {
                return res.status(404).json({ success: false, message: 'Boleto no encontrado.' });
            }
            throw regenerateError;
        }

        const { data: newTicket, error: insertError } = await supabase
            .from('tickets')
            .select('*, matches(opponent, match_date, stadium_name), zones(name)')
            .eq('id', newTicketId)
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
    getOfflineMatches,
    getOfflineTicketManifest,
    syncOfflineTicketScans,
    supportSearchTickets,
    supportRegenerateTicket
};
