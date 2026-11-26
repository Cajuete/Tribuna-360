const { supabase } = require('../config/supabase');

const getTicketCapacity = async (matchId, zoneId) => {
    const { data: zone, error: zoneError } = await supabase
        .from('zones')
        .select('id, match_id, capacity, tickets_for_sale, is_enabled, sale_mode')
        .eq('id', zoneId)
        .eq('match_id', matchId)
        .maybeSingle();
    if (zoneError) throw zoneError;
    if (!zone) return { zone: null, available: 0 };

    const { count, error: ticketError } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('zone_id', zoneId)
        .or('status.is.null,status.neq.cancelled');
    if (ticketError) throw ticketError;

    const saleLimit = Math.min(
        Number(zone.capacity),
        Number(zone.tickets_for_sale ?? zone.capacity),
    );
    return {
        zone,
        available: Math.max(saleLimit - (count || 0), 0),
    };
};

module.exports = { getTicketCapacity };
