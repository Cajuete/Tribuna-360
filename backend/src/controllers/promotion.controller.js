const { supabase } = require('../config/supabase');

const tenantFilter = (req, query) => {
    if (req.user.role === 'superadmin') {
        if (req.query.tenant_id) query = query.eq('tenant_id', req.query.tenant_id);
        return query;
    }
    return query.eq('tenant_id', req.user.tenant_id);
};

const getPromotions = async (req, res) => {
    try {
        let query = supabase.from('promotions').select('*, tenants(name)').order('created_at', { ascending: false });
        query = tenantFilter(req, query);
        if (req.query.active === 'true') query = query.eq('is_active', true);
        const { data, error } = await query;
        if (error) throw error;
        return res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al obtener promociones', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};
const createPromotion = async (req, res) => {
    try {
        const {
            code, description, discount_type, discount_value, applies_to,
            zone_name, max_uses, starts_at, ends_at, is_active, tenant_id
        } = req.body;

        if (!code || discount_value === undefined || discount_value === null) {
            return res.status(400).json({ success: false, message: 'Código y valor de descuento son requeridos.' });
        }

        const tid = req.user.role === 'superadmin' ? (tenant_id || req.user.tenant_id) : req.user.tenant_id;
        if (!tid) {
            return res.status(400).json({ success: false, message: 'tenant_id es requerido.' });
        }

        const payload = {
            tenant_id: tid,
            code: String(code).trim().toUpperCase(),
            description: description || null,
            discount_type: discount_type === 'fixed' ? 'fixed' : 'percentage',
            discount_value: Number(discount_value),
            applies_to: ['tickets', 'products', 'both'].includes(applies_to) ? applies_to : 'both',
            zone_name: zone_name || null,
            max_uses: max_uses ? Number(max_uses) : null,
            starts_at: starts_at || null,
            ends_at: ends_at || null,
            is_active: is_active !== false
        };

        const { data, error } = await supabase.from('promotions').insert([payload]).select('*, tenants(name)').single();
        if (error) throw error;
        return res.status(201).json({ success: true, message: 'Promoción creada.', data });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al crear la promoción', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const updatePromotion = async (req, res) => {
    try {
        const { id } = req.params;
        const { data: existing, error: findError } = await supabase
            .from('promotions').select('id, tenant_id').eq('id', id).single();
        if (findError || !existing) {
            return res.status(404).json({ success: false, message: 'Promoción no encontrada.' });
        }
        if (req.user.role !== 'superadmin' && existing.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({ success: false, message: 'Promoción de otro club.' });
        }

        const patch = {};
        const allowed = ['code', 'description', 'discount_type', 'discount_value', 'applies_to', 'zone_name', 'max_uses', 'starts_at', 'ends_at', 'is_active'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                if (key === 'code') patch.code = String(req.body.code).trim().toUpperCase();
                else if (key === 'discount_type') patch.discount_type = req.body.discount_type === 'fixed' ? 'fixed' : 'percentage';
                else if (key === 'applies_to') patch.applies_to = ['tickets', 'products', 'both'].includes(req.body.applies_to) ? req.body.applies_to : 'both';
                else patch[key] = req.body[key];
            }
        }

        const { data, error } = await supabase.from('promotions').update(patch).eq('id', id).select('*, tenants(name)').single();
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Promoción actualizada.', data });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al actualizar la promoción', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const deletePromotion = async (req, res) => {
    try {
        const { id } = req.params;
        const { data: existing, error: findError } = await supabase
            .from('promotions').select('id, tenant_id').eq('id', id).single();
        if (findError || !existing) {
            return res.status(404).json({ success: false, message: 'Promoción no encontrada.' });
        }
        if (req.user.role !== 'superadmin' && existing.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({ success: false, message: 'Promoción de otro club.' });
        }
        const { error } = await supabase.from('promotions').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Promoción eliminada.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al eliminar la promoción', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};
const getSalesMetrics = async (req, res) => {
    try {
        const isSuperadmin = req.user.role === 'superadmin';
        const tenantId = isSuperadmin ? (req.query.tenant_id || null) : req.user.tenant_id;

        let matchesQuery = supabase.from('matches').select('id, opponent, match_date, stadium_name, status, tenant_id');
        if (tenantId) matchesQuery = matchesQuery.eq('tenant_id', tenantId);
        const { data: matches, error: matchError } = await matchesQuery.order('match_date', { ascending: false });
        if (matchError) throw matchError;

        const matchIds = (matches || []).map(m => m.id);
        let zones = [];
        if (matchIds.length) {
            const { data: z, error: zoneError } = await supabase.from('zones').select('id, match_id, name, price, capacity').in('match_id', matchIds);
            if (zoneError) throw zoneError;
            zones = z || [];
        }

        let tickets = [];
        if (matchIds.length) {
            const { data: t, error: ticketError } = await supabase.from('tickets').select('id, match_id, zone_id, price, status, created_at').in('match_id', matchIds);
            if (ticketError) throw ticketError;
            tickets = t || [];
        }

        let ordersQuery = supabase.from('orders').select('id, total, status, tenant_id');
        if (tenantId) ordersQuery = ordersQuery.eq('tenant_id', tenantId);
        const { data: orders, error: orderError } = await ordersQuery;
        if (orderError) throw orderError;

        const ticketsByZone = {};
        for (const t of tickets) {
            ticketsByZone[t.zone_id] = ticketsByZone[t.zone_id] || { sold: 0, revenue: 0, used: 0 };
            ticketsByZone[t.zone_id].sold += 1;
            ticketsByZone[t.zone_id].revenue += Number(t.price || 0);
            if (t.status === 'used') ticketsByZone[t.zone_id].used += 1;
        }
        const globalEarlyBuckets = { '0-1': 0, '2-3': 0, '4-7': 0, '8+': 0 };
        const matchMetrics = (matches || []).map(m => {
const matchTickets = tickets.filter(t => t.match_id === m.id);
            const earlyBuckets = { '0-1': 0, '2-3': 0, '4-7': 0, '8+': 0 };
            const matchDate = m.match_date ? new Date(m.match_date) : null;
            for (const t of matchTickets) {
                if (!matchDate || !t.created_at) continue;
                const created = new Date(t.created_at);
                const diffMs = matchDate.getTime() - created.getTime();
                if (diffMs < 0) continue;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                if (diffDays <= 1) earlyBuckets['0-1'] += 1;
                else if (diffDays <= 3) earlyBuckets['2-3'] += 1;
                else if (diffDays <= 7) earlyBuckets['4-7'] += 1;
                else earlyBuckets['8+'] += 1;
            }
            const advanceSold = earlyBuckets['4-7'] + earlyBuckets['8+'];
            for (const k of Object.keys(earlyBuckets)) globalEarlyBuckets[k] += earlyBuckets[k];
            const matchZones = zones.filter(z => z.match_id === m.id);
            const zoneMetrics = matchZones.map(z => {
                const stats = ticketsByZone[z.id] || { sold: 0, revenue: 0, used: 0 };
                const capacity = Number(z.capacity || 0);
                const conversion = capacity > 0 ? (stats.sold / capacity) * 100 : 0;
                return {
                    zone_id: z.id,
                    zone_name: z.name,
                    price: z.price,
                    capacity,
                    sold: stats.sold,
                    used: stats.used,
                    revenue: stats.revenue,
                    conversion_rate: Number(conversion.toFixed(2)),
                    remaining: Math.max(capacity - stats.sold, 0)
                };
            });
            const totalCapacity = zoneMetrics.reduce((s, z) => s + z.capacity, 0);
            const totalSold = zoneMetrics.reduce((s, z) => s + z.sold, 0);
            return {
                match_id: m.id,
                opponent: m.opponent,
                match_date: m.match_date,
                stadium_name: m.stadium_name,
                status: m.status,
                zones: zoneMetrics,
                total_capacity: totalCapacity,
                total_sold: totalSold,
                total_revenue: zoneMetrics.reduce((s, z) => s + z.revenue, 0),
                conversion_rate: totalCapacity > 0 ? Number(((totalSold / totalCapacity) * 100).toFixed(2)) : 0,
                early_sales: earlyBuckets,
                advance_sold: advanceSold,
                advance_rate: totalSold > 0 ? Number(((advanceSold / totalSold) * 100).toFixed(2)) : 0
            };
        });

        const totalTickets = tickets.length;
        const totalTicketRevenue = tickets.reduce((s, t) => s + Number(t.price || 0), 0);
        const totalCapacity = zones.reduce((s, z) => s + Number(z.capacity || 0), 0);
        const paidOrders = (orders || []).filter(o => o.status === 'paid' || o.status === 'shipped');
        const storeRevenue = paidOrders.reduce((s, o) => s + Number(o.total || 0), 0);

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    matches: (matches || []).length,
                    zones: zones.length,
                    capacity: totalCapacity,
                    tickets_sold: totalTickets,
                    ticket_revenue: totalTicketRevenue,
                    sell_through: totalCapacity > 0 ? Number(((totalTickets / totalCapacity) * 100).toFixed(2)) : 0,
                    orders: (orders || []).length,
                    paid_orders: paidOrders.length,
                    store_revenue: storeRevenue,
                    avg_order_value: paidOrders.length > 0 ? Number((storeRevenue / paidOrders.length).toFixed(2)) : 0,
                    early_sales: globalEarlyBuckets,
                    advance_sold: globalEarlyBuckets['4-7'] + globalEarlyBuckets['8+'],
                    advance_rate: totalTickets > 0 ? Number((((globalEarlyBuckets['4-7'] + globalEarlyBuckets['8+']) / totalTickets) * 100).toFixed(2)) : 0
                },
                matches: matchMetrics
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al calcular métricas de ventas', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

module.exports = {
    getPromotions,
    createPromotion,
    updatePromotion,
    deletePromotion,
    getSalesMetrics
};