const { supabase } = require('../config/supabase');

const canManageMatch = async (req, matchId) => {
    const { data: match } = await supabase
        .from('matches')
        .select('id, tenant_id')
        .eq('id', matchId)
        .maybeSingle();

    if (!match) return { ok: false, status: 404, message: 'Partido no encontrado.' };
    if (req.user.role !== 'superadmin' && match.tenant_id !== req.user.tenant_id) {
        return { ok: false, status: 403, message: 'Este partido pertenece a otro club.' };
    }
    return { ok: true };
};

const createZone = async (req, res) => {
    try {
        const { matchId } = req.params;
        const { name, price, capacity, is_enabled, tickets_for_sale } = req.body;

        const check = await canManageMatch(req, matchId);
        if (!check.ok) return res.status(check.status).json({ status: 'error', message: check.message });

        const priceNum = Number(price);
        const capacityNum = Number.parseInt(capacity, 10);
        const enabled = is_enabled === undefined ? true : Boolean(is_enabled);
        const saleLimit = tickets_for_sale === undefined || tickets_for_sale === null || tickets_for_sale === ''
            ? capacityNum
            : Number.parseInt(tickets_for_sale, 10);

        if (!name || !Number.isFinite(priceNum) || priceNum < 0 || !Number.isInteger(capacityNum) || capacityNum < 1 ||
            !Number.isInteger(saleLimit) || saleLimit < 0 || saleLimit > capacityNum) {
            return res.status(400).json({ status: 'error', message: 'Datos inválidos: nombre, precio (>=0), capacidad (>=1) y entradas a la venta (0..capacidad) son requeridos.' });
        }

        const { data, error } = await supabase
            .from('zones')
            .insert([{ match_id: matchId, name, price: priceNum, capacity: capacityNum, is_enabled: enabled, tickets_for_sale: saleLimit }])
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({ status: 'success', message: `Zona "${name}" creada.`, data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al crear la zona', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const updateZone = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, capacity, is_enabled, tickets_for_sale } = req.body;

        const { data: zone } = await supabase
            .from('zones')
            .select('id, match_id, capacity')
            .eq('id', id)
            .maybeSingle();

        if (!zone) return res.status(404).json({ status: 'error', message: 'Zona no encontrada.' });

        const check = await canManageMatch(req, zone.match_id);
        if (!check.ok) return res.status(check.status).json({ status: 'error', message: check.message });

        const patch = {};
        if (name) patch.name = name;
        if (price !== undefined) {
            const n = Number(price);
            if (!Number.isFinite(n) || n < 0) return res.status(400).json({ status: 'error', message: 'Precio inválido.' });
            patch.price = n;
        }
        if (capacity !== undefined) {
            const n = Number.parseInt(capacity, 10);
            if (!Number.isInteger(n) || n < 1) return res.status(400).json({ status: 'error', message: 'Capacidad inválida.' });
            patch.capacity = n;
        }
        if (is_enabled !== undefined) {
            patch.is_enabled = Boolean(is_enabled);
        }
        if (tickets_for_sale !== undefined) {
            const n = Number.parseInt(tickets_for_sale, 10);
            if (!Number.isInteger(n) || n < 0) return res.status(400).json({ status: 'error', message: 'Entradas a la venta inválidas.' });
            const cap = patch.capacity !== undefined ? patch.capacity : zone.capacity;
            if (n > cap) return res.status(400).json({ status: 'error', message: 'Las entradas a la venta no pueden superar la capacidad.' });
            patch.tickets_for_sale = n;
        }
        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ status: 'error', message: 'No se envió ningún campo para actualizar.' });
        }

        const { data, error } = await supabase
            .from('zones')
            .update(patch)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({ status: 'success', message: 'Zona actualizada.', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al actualizar la zona', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const deleteZone = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: zone } = await supabase
            .from('zones')
            .select('id, match_id, name')
            .eq('id', id)
            .maybeSingle();

        if (!zone) return res.status(404).json({ status: 'error', message: 'Zona no encontrada.' });

        const check = await canManageMatch(req, zone.match_id);
        if (!check.ok) return res.status(check.status).json({ status: 'error', message: check.message });

        const { count } = await supabase
            .from('tickets')
            .select('id', { count: 'exact', head: true })
            .eq('zone_id', id);

        if (count > 0) {
            return res.status(409).json({
                status: 'error',
                message: `No se puede eliminar "${zone.name}": tiene ${count} entrada(s) vendida(s).`
            });
        }

        const { error } = await supabase.from('zones').delete().eq('id', id);
        if (error) throw error;

        return res.status(200).json({ status: 'success', message: `Zona "${zone.name}" eliminada.`, data: zone });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al eliminar la zona', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

module.exports = {
    createZone,
    updateZone,
    deleteZone
};
