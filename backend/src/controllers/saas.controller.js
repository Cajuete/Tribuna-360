const { supabase } = require('../config/supabase');

const getOverview = async (req, res) => {
  try {
    const [tenantsRes, matchesRes, ticketsRes, ordersRes] = await Promise.all([
      supabase.from('tenants').select('id, name, slug, is_active, subscription_status, subscription_plan, commission_rate, created_at').order('name', { ascending: true }),
      supabase.from('matches').select('id, tenant_id'),
      supabase.from('tickets').select('match_id, price, status'),
      supabase.from('orders').select('tenant_id, total, status'),
    ]);

    if (tenantsRes.error) throw tenantsRes.error;
    if (matchesRes.error) throw matchesRes.error;
    if (ticketsRes.error) throw ticketsRes.error;
    if (ordersRes.error) throw ordersRes.error;

    const matches = matchesRes.data || [];
    const tickets = ticketsRes.data || [];
    const orders = ordersRes.data || [];

    const matchTenant = new Map(matches.map(m => [m.id, m.tenant_id]));

    const tenantMetrics = new Map();
    for (const t of tenantsRes.data || []) {
      tenantMetrics.set(t.id, {
        ...t,
        matches_count: 0,
        tickets_sold: 0,
        ticket_revenue: 0,
        orders_count: 0,
        order_revenue: 0,
      });
    }

    for (const m of matches) {
      const metric = tenantMetrics.get(m.tenant_id);
      if (metric) metric.matches_count += 1;
    }

    for (const tk of tickets) {
      const tenantId = matchTenant.get(tk.match_id);
      const metric = tenantId ? tenantMetrics.get(tenantId) : null;
      if (metric) {
        metric.tickets_sold += 1;
        metric.ticket_revenue += Number(tk.price || 0);
      }
    }

    for (const o of orders) {
      const metric = tenantMetrics.get(o.tenant_id);
      if (metric) {
        metric.orders_count += 1;
        if (o.status === 'paid' || o.status === 'shipped') {
          metric.order_revenue += Number(o.total || 0);
        }
      }
    }

    const tenants = Array.from(tenantMetrics.values()).map(m => ({
      ...m,
      total_revenue: m.ticket_revenue + m.order_revenue,
    }));

    const totals = tenants.reduce((acc, t) => ({
      clubs: acc.clubs + 1,
      active_clubs: acc.active_clubs + (t.is_active ? 1 : 0),
      matches: acc.matches + t.matches_count,
      tickets_sold: acc.tickets_sold + t.tickets_sold,
      ticket_revenue: acc.ticket_revenue + t.ticket_revenue,
      orders_count: acc.orders_count + t.orders_count,
      order_revenue: acc.order_revenue + t.order_revenue,
      total_revenue: acc.total_revenue + t.total_revenue,
    }), { clubs: 0, active_clubs: 0, matches: 0, tickets_sold: 0, ticket_revenue: 0, orders_count: 0, order_revenue: 0, total_revenue: 0 });

    return res.status(200).json({ status: 'success', data: { tenants, totals } });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Error al obtener métricas globales', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
  }
};

const getSettings = async (req, res) => {
  try {
    let { data, error } = await supabase
      .from('platform_settings')
      .select('id, payment_provider, payment_public_key, payment_secret_key, platform_commission_rate, currency, updated_at')
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const { data: created, error: createError } = await supabase
        .from('platform_settings')
        .insert([{ payment_provider: 'simulado', platform_commission_rate: 5, currency: 'BOB' }])
        .select('id, payment_provider, payment_public_key, payment_secret_key, platform_commission_rate, currency, updated_at')
        .single();
      if (createError) throw createError;
      data = created;
    }

    return res.status(200).json({
      status: 'success',
      data: {
        ...data,
        payment_secret_key: data.payment_secret_key ? '••••••••' : '',
      },
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Error al obtener configuración global', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { payment_provider, payment_public_key, payment_secret_key, platform_commission_rate, currency } = req.body;

    const { data: existing, error: fetchError } = await supabase
      .from('platform_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const patch = {};
    if (payment_provider !== undefined) patch.payment_provider = String(payment_provider).trim() || 'simulado';
    if (payment_public_key !== undefined) patch.payment_public_key = payment_public_key ? String(payment_public_key).trim() : null;
    if (payment_secret_key !== undefined && payment_secret_key !== '' && payment_secret_key !== '••••••••') {
      patch.payment_secret_key = String(payment_secret_key).trim();
    }
    if (platform_commission_rate !== undefined) {
      const rate = Number(platform_commission_rate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        return res.status(400).json({ status: 'error', message: 'La comisión global debe ser un número entre 0 y 100.' });
      }
      patch.platform_commission_rate = rate;
    }
    if (currency !== undefined) patch.currency = String(currency).trim() || 'BOB';
    patch.updated_at = new Date().toISOString();

    if (Object.keys(patch).length <= 1) {
      return res.status(400).json({ status: 'error', message: 'No hay datos para actualizar.' });
    }

    if (existing?.id) {
      const { data, error } = await supabase
        .from('platform_settings')
        .update(patch)
        .eq('id', existing.id)
        .select('id, payment_provider, payment_public_key, payment_secret_key, platform_commission_rate, currency, updated_at')
        .single();
      if (error) throw error;
      return res.status(200).json({ status: 'success', message: 'Configuración global actualizada.', data: { ...data, payment_secret_key: data.payment_secret_key ? '••••••••' : '' } });
    }

    const { data, error } = await supabase
      .from('platform_settings')
      .insert([{
        payment_provider: patch.payment_provider || 'simulado',
        payment_public_key: patch.payment_public_key || null,
        payment_secret_key: patch.payment_secret_key || null,
        platform_commission_rate: patch.platform_commission_rate ?? 5,
        currency: patch.currency || 'BOB',
      }])
      .select('id, payment_provider, payment_public_key, payment_secret_key, platform_commission_rate, currency, updated_at')
      .single();
    if (error) throw error;
    return res.status(201).json({ status: 'success', message: 'Configuración global creada.', data: { ...data, payment_secret_key: data.payment_secret_key ? '••••••••' : '' } });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Error al actualizar configuración global', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
  }
};

module.exports = { getOverview, getSettings, updateSettings };