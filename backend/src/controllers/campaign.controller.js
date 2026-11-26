const { supabase } = require('../config/supabase');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLACEMENTS = ['home', 'club', 'store', 'matches', 'memberships'];
const HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;
const CAMPAIGN_SELECTS = [
    '*, tenants(name, slug), campaign_offers(*, products(id, name, price, image_url, tenant_id)), campaign_ticket_offers(*, matches(id, opponent, match_date), zones(id, name, price)), campaign_membership_offers(*, membership_plans(id, name, price, tenant_id, duration_days))',
    '*, tenants(name, slug), campaign_offers(*, products(id, name, price, image_url, tenant_id)), campaign_ticket_offers(*, matches(id, opponent, match_date), zones(id, name, price))',
    '*, tenants(name, slug), campaign_offers(*, products(id, name, price, image_url, tenant_id))',
];

const isMissingOptionalRelation = error =>
    /could not find a relationship between 'promotion_campaigns' and 'campaign_(ticket|membership)_offers'/i.test(error?.message || '');

const isMissingCampaignRpc = error =>
    error?.code === 'PGRST202' || /could not find the function public\.save_promotion_campaign/i.test(error?.message || '');

const fetchCampaigns = async buildQuery => {
    let lastError;
    for (let index = 0; index < CAMPAIGN_SELECTS.length; index += 1) {
        const { data, error } = await buildQuery(CAMPAIGN_SELECTS[index]);
        if (!error) return data || [];
        lastError = error;
        if (!isMissingOptionalRelation(error)) throw error;
    }
    throw lastError;
};

const resolveTenantId = (req) => {
    if (req.user.role === 'superadmin') {
        return req.body.tenant_id || req.query.tenant_id || null;
    }
    return req.user.tenant_id || null;
};

const scopeCampaignQuery = (req, query, tenantId) => {
    if (req.user.role === 'superadmin') {
        if (tenantId) query = query.eq('tenant_id', tenantId);
        return query;
    }
    return query.eq('tenant_id', req.user.tenant_id);
};

const validatePayload = (body) => {
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const bannerImageUrl = typeof body?.banner_image_url === 'string' ? body.banner_image_url.trim() : '';
    const placements = Array.isArray(body?.placements) ? [...new Set(body.placements)] : [];
    const startsAt = typeof body?.starts_at === 'string' ? new Date(body.starts_at) : null;
    const endsAt = typeof body?.ends_at === 'string' ? new Date(body.ends_at) : null;
    const offers = body?.offers;
    const ticketOffers = body?.ticket_offers === undefined ? [] : body.ticket_offers;
    const membershipOffers = body?.membership_offers === undefined ? [] : body.membership_offers;

    if (title.length < 2 || title.length > 120 || description.length > 500 ||
        !bannerImageUrl ||
        (bannerImageUrl && (bannerImageUrl.length > 500 || !HTTP_URL_RE.test(bannerImageUrl))) ||
        placements.length === 0 || placements.some(item => !PLACEMENTS.includes(item)) ||
        !startsAt || Number.isNaN(startsAt.getTime()) || !endsAt || Number.isNaN(endsAt.getTime()) ||
        endsAt <= startsAt || !Array.isArray(offers) || offers.length > 30 ||
        !Array.isArray(ticketOffers) || ticketOffers.length > 30 ||
        !Array.isArray(membershipOffers) || membershipOffers.length > 30 ||
        offers.length + ticketOffers.length + membershipOffers.length < 1 ||
        offers.length + ticketOffers.length + membershipOffers.length > 30 ||
        (body?.is_active !== undefined && typeof body.is_active !== 'boolean')) {
        return { error: 'Revisa el nombre, las fechas, el banner, las ubicaciones y las ofertas de la campaña.' };
    }

    const productIds = new Set();
    const cleanOffers = [];
    for (const offer of offers) {
        const productId = String(offer?.product_id || '').toLowerCase();
        const discountType = offer?.discount_type;
        const discountValue = Number(offer?.discount_value);
        if (!UUID_RE.test(productId) || productIds.has(productId) ||
            !['percentage', 'fixed'].includes(discountType) ||
            !Number.isFinite(discountValue) || discountValue <= 0 ||
            (discountType === 'percentage' && discountValue > 100)) {
            return { error: 'Cada oferta debe seleccionar un producto distinto y un descuento válido.' };
        }
        productIds.add(productId);
        cleanOffers.push({
            product_id: productId,
            discount_type: discountType,
            discount_value: discountValue,
        });
    }

    const ticketZoneIds = new Set();
    const cleanTicketOffers = [];
    for (const offer of ticketOffers) {
        const matchId = String(offer?.match_id || '').toLowerCase();
        const zoneId = String(offer?.zone_id || '').toLowerCase();
        const discountType = offer?.discount_type;
        const discountValue = Number(offer?.discount_value);
        const key = `${matchId}:${zoneId}`;
        if (!UUID_RE.test(matchId) || !UUID_RE.test(zoneId) || ticketZoneIds.has(key) ||
            !['percentage', 'fixed'].includes(discountType) ||
            !Number.isFinite(discountValue) || discountValue <= 0 ||
            (discountType === 'percentage' && discountValue > 100)) {
            return { error: 'Cada oferta de entradas debe tener un partido, una zona y un descuento válido.' };
        }
        ticketZoneIds.add(key);
        cleanTicketOffers.push({
            match_id: matchId,
            zone_id: zoneId,
            discount_type: discountType,
            discount_value: discountValue,
        });
    }

    const planIds = new Set();
    const cleanMembershipOffers = [];
    for (const offer of membershipOffers) {
        const planId = String(offer?.plan_id || '').toLowerCase();
        const discountType = offer?.discount_type;
        const discountValue = Number(offer?.discount_value);
        if (!UUID_RE.test(planId) || planIds.has(planId) ||
            !['percentage', 'fixed'].includes(discountType) ||
            !Number.isFinite(discountValue) || discountValue <= 0 ||
            (discountType === 'percentage' && discountValue >= 100)) {
            return { error: 'Cada oferta para socios debe seleccionar un plan distinto y un descuento menor al precio del plan.' };
        }
        planIds.add(planId);
        cleanMembershipOffers.push({
            plan_id: planId,
            discount_type: discountType,
            discount_value: discountValue,
        });
    }

    return {
        value: {
            title,
            description: description || null,
            banner_image_url: bannerImageUrl || null,
            placements,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            is_active: body.is_active !== false,
            offers: cleanOffers,
            ticket_offers: cleanTicketOffers,
            membership_offers: cleanMembershipOffers,
        },
    };
};

const buildCampaignQuery = (select, req, tenantId, placement) => {
    let query = supabase.from('promotion_campaigns').select(select);
    query = scopeCampaignQuery(req, query, tenantId);
    if (placement) query = query.contains('placements', [placement]);
    return query.order('created_at', { ascending: false });
};

const getCampaigns = async (req, res) => {
    try {
        const tenantId = req.query.tenant_id;
        if (tenantId && !UUID_RE.test(String(tenantId))) {
            return res.status(400).json({ success: false, message: 'El club seleccionado no es válido.' });
        }
        const data = await fetchCampaigns(select => buildCampaignQuery(select, req, tenantId, null));
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'No se pudieron obtener las campañas.',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message,
        });
    }
};

const getPublicCampaigns = async (req, res) => {
    try {
        const tenantId = req.query.tenant_id;
        const placement = req.query.placement;
        if (tenantId && !UUID_RE.test(String(tenantId))) {
            return res.status(400).json({ success: false, message: 'El club solicitado no es válido.' });
        }
        if (placement && !PLACEMENTS.includes(String(placement))) {
            return res.status(400).json({ success: false, message: 'La ubicación solicitada no es válida.' });
        }

        const now = new Date().toISOString();
        const data = await fetchCampaigns(select => {
            let query = supabase.from('promotion_campaigns')
                .select(select)
                .eq('is_active', true)
                .lte('starts_at', now)
                .gte('ends_at', now)
                .order('starts_at', { ascending: true });
            if (tenantId) query = query.eq('tenant_id', tenantId);
            if (placement) query = query.contains('placements', [placement]);
            return query;
        });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'No se pudieron cargar las campañas vigentes.',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message,
        });
    }
};

const saveCampaign = async (req, res) => {
    try {
        const validation = validatePayload(req.body);
        if (validation.error) {
            return res.status(400).json({ success: false, message: validation.error });
        }

        const tenantId = resolveTenantId(req);
        if (!tenantId || !UUID_RE.test(String(tenantId))) {
            return res.status(400).json({ success: false, message: 'Selecciona un club válido para la campaña.' });
        }

        let campaignId = null;
        if (req.params.id) {
            if (!UUID_RE.test(req.params.id)) {
                return res.status(400).json({ success: false, message: 'La campaña solicitada no es válida.' });
            }
            let existingQuery = supabase.from('promotion_campaigns').select('id, tenant_id').eq('id', req.params.id);
            if (req.user.role !== 'superadmin') existingQuery = existingQuery.eq('tenant_id', req.user.tenant_id);
            const { data: existing, error: existingError } = await existingQuery.maybeSingle();
            if (existingError) throw existingError;
            if (!existing) return res.status(404).json({ success: false, message: 'Campaña no encontrada.' });
            campaignId = existing.id;
            if (req.user.role === 'superadmin') {
                if (tenantId !== existing.tenant_id) {
                    return res.status(400).json({ success: false, message: 'No se puede cambiar de club una campaña existente.' });
                }
            }
        }

        const rpcArgs = {
            p_campaign_id: campaignId,
            p_tenant_id: tenantId,
            p_title: validation.value.title,
            p_description: validation.value.description,
            p_banner_image_url: validation.value.banner_image_url,
            p_placements: validation.value.placements,
            p_starts_at: validation.value.starts_at,
            p_ends_at: validation.value.ends_at,
            p_is_active: validation.value.is_active,
            p_offers: validation.value.offers,
            p_ticket_offers: validation.value.ticket_offers,
            p_membership_offers: validation.value.membership_offers,
        };
        let rpcResult = await supabase.rpc('save_promotion_campaign', rpcArgs);
        if (isMissingCampaignRpc(rpcResult.error) && validation.value.membership_offers.length === 0) {
            const ticketCompatibleArgs = { ...rpcArgs };
            delete ticketCompatibleArgs.p_membership_offers;
            rpcResult = await supabase.rpc('save_promotion_campaign', ticketCompatibleArgs);
        }
        if (isMissingCampaignRpc(rpcResult.error) &&
            validation.value.ticket_offers.length === 0 &&
            validation.value.membership_offers.length === 0) {
            const productCompatibleArgs = { ...rpcArgs };
            delete productCompatibleArgs.p_ticket_offers;
            rpcResult = await supabase.rpc('save_promotion_campaign', productCompatibleArgs);
        }
        const { data, error } = rpcResult;
        if (error) {
            if (isMissingCampaignRpc(error) && validation.value.membership_offers.length > 0) {
                return res.status(503).json({
                    success: false,
                    message: 'Aplica las migraciones 029_campaign_ticket_discounts.sql y 030_campaign_membership_discounts.sql para activar descuentos de membresía.',
                });
            }
            if (isMissingCampaignRpc(error) && validation.value.ticket_offers.length > 0) {
                return res.status(503).json({
                    success: false,
                    message: 'Aplica la migración 029_campaign_ticket_discounts.sql para activar descuentos de entradas.',
                });
            }
            if (error.message.includes('INVALID_CAMPAIGN_TICKET_OFFER')) {
                return res.status(400).json({ success: false, message: 'Una oferta usa un partido o zona que no pertenece a este club, o tiene datos inválidos.' });
            }
            if (error.message.includes('INVALID_CAMPAIGN_MEMBERSHIP_OFFER')) {
                return res.status(400).json({ success: false, message: 'Una oferta usa un plan que no pertenece a este club o el descuento supera el precio del plan.' });
            }
            if (error.message.includes('INVALID_CAMPAIGN_OFFER')) {
                return res.status(400).json({ success: false, message: 'Una oferta usa un producto que no pertenece a este club o tiene datos inválidos.' });
            }
            if (error.message.includes('CAMPAIGN_NOT_FOUND')) {
                return res.status(404).json({ success: false, message: 'Campaña no encontrada.' });
            }
            throw error;
        }
        return res.status(200).json({
            success: true,
            message: campaignId ? 'Campaña actualizada.' : 'Campaña creada.',
            data: { id: data },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'No se pudo guardar la campaña.',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message,
        });
    }
};

const setCampaignActive = async (req, res) => {
    try {
        const { id } = req.params;
        if (!UUID_RE.test(id) || typeof req.body?.is_active !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Indica un estado válido para la campaña.' });
        }
        let query = supabase.from('promotion_campaigns').update({
            is_active: req.body.is_active,
            updated_at: new Date().toISOString(),
        }).eq('id', id);
        if (req.user.role !== 'superadmin') query = query.eq('tenant_id', req.user.tenant_id);
        const { data, error } = await query.select('id').maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ success: false, message: 'Campaña no encontrada.' });
        return res.status(200).json({ success: true, message: 'Estado de campaña actualizado.' });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'No se pudo cambiar el estado de la campaña.',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message,
        });
    }
};

const deleteCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        if (!UUID_RE.test(id)) {
            return res.status(400).json({ success: false, message: 'La campaña solicitada no es válida.' });
        }
        let query = supabase.from('promotion_campaigns').delete().eq('id', id);
        if (req.user.role !== 'superadmin') query = query.eq('tenant_id', req.user.tenant_id);
        const { data, error } = await query.select('id').maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ success: false, message: 'Campaña no encontrada.' });
        return res.status(200).json({ success: true, message: 'Campaña eliminada.' });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'No se pudo eliminar la campaña.',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message,
        });
    }
};

module.exports = {
    getCampaigns,
    getPublicCampaigns,
    saveCampaign,
    setCampaignActive,
    deleteCampaign,
};
