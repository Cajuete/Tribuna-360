const { supabase } = require('../config/supabase');
const getMatches = async (req, res) => {
    try {
        const { tenant_id } = req.query; 

        let query = supabase.from('matches').select('*, tenants(name, slug)');

        if (tenant_id) {
            query = query.eq('tenant_id', tenant_id);
        }

        const { data, error } = await query.order('match_date', { ascending: true });

        if (error) {
            return res.status(400).json({ status: 'error', message: error.message });
        }

        res.status(200).json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: err.message });
    }
};
const MATCH_STATUSES = ['scheduled', 'live', 'finished', 'cancelled'];

const isMissingDetailsColumn = (error) => {
    if (!error) return false;
    return error.code === 'PGRST204' ||
        /competition|matchday/i.test(error.message || '') ||
        /column .* does not exist/i.test(error.message || '');
};

const parseMatchday = (value) => {
    if (value === undefined || value === null || String(value).trim() === '') return { ok: true, value: null };
    const n = Number.parseInt(value, 10);
    if (!Number.isInteger(n) || n < 1) return { ok: false };
    return { ok: true, value: n };
};

const createMatch = async (req, res) => {
    try {
        const { opponent, match_date, stadium_name, competition, matchday } = req.body;
        let tenant_id = req.body.tenant_id;

        if (req.user.role === 'club_admin') {
            tenant_id = req.user.tenant_id;
        }

        if (!tenant_id || !opponent || !opponent.trim() || !match_date || !stadium_name || !stadium_name.trim()) {
            return res.status(400).json({ status: 'error', message: 'Faltan campos obligatorios para programar el partido.' });
        }

        if (Number.isNaN(new Date(match_date).getTime())) {
            return res.status(400).json({ status: 'error', message: 'La fecha y hora del partido no es válida.' });
        }

        const md = parseMatchday(matchday);
        if (!md.ok) {
            return res.status(400).json({ status: 'error', message: 'La jornada debe ser un número entero mayor o igual a 1.' });
        }

        const payload = {
            tenant_id,
            opponent: opponent.trim(),
            match_date,
            stadium_name: stadium_name.trim(),
            status: 'scheduled'
        };

        if (competition && competition.trim()) payload.competition = competition.trim();
        if (md.value !== null) payload.matchday = md.value;

        const { data, error } = await supabase
            .from('matches')
            .insert([payload])
            .select();

        if (error) {
            if (isMissingDetailsColumn(error)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Falta aplicar la migración 003_match_details.sql para guardar competencia y jornada.'
                });
            }
            return res.status(400).json({ status: 'error', message: error.message });
        }

        res.status(201).json({ status: 'success', message: 'Partido programado exitosamente', data: data[0] });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: err.message });
    }
};
const updateMatch = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Se requiere el identificador del partido para la actualización.'
            });
        }

        const { data: existing } = await supabase
            .from('matches')
            .select('id, tenant_id')
            .eq('id', id)
            .maybeSingle();

        if (!existing) {
            return res.status(404).json({
                status: 'error',
                message: 'El partido especificado no existe o no pudo ser encontrado.'
            });
        }

        if (req.user.role !== 'superadmin' && existing.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({
                status: 'error',
                message: 'Este partido pertenece a otro club.'
            });
        }

        const has = (key) => Object.prototype.hasOwnProperty.call(req.body, key);
        const patch = {};

        if (has('opponent')) {
            if (!req.body.opponent || !req.body.opponent.trim()) {
                return res.status(400).json({ status: 'error', message: 'El rival no puede estar vacío.' });
            }
            patch.opponent = req.body.opponent.trim();
        }

        if (has('competition')) {
            patch.competition = req.body.competition ? String(req.body.competition).trim() : null;
        }

        if (has('matchday')) {
            const md = parseMatchday(req.body.matchday);
            if (!md.ok) {
                return res.status(400).json({ status: 'error', message: 'La jornada debe ser un número entero mayor o igual a 1.' });
            }
            patch.matchday = md.value;
        }

        if (has('match_date')) {
            if (Number.isNaN(new Date(req.body.match_date).getTime())) {
                return res.status(400).json({ status: 'error', message: 'La fecha y hora del partido no es válida.' });
            }
            patch.match_date = req.body.match_date;
        }

        if (has('stadium_name')) {
            if (!req.body.stadium_name || !req.body.stadium_name.trim()) {
                return res.status(400).json({ status: 'error', message: 'El estadio no puede estar vacío.' });
            }
            patch.stadium_name = req.body.stadium_name.trim();
        }

        if (has('status')) {
            if (!MATCH_STATUSES.includes(req.body.status)) {
                return res.status(400).json({ status: 'error', message: 'Estado de partido inválido.' });
            }
            patch.status = req.body.status;
        }

        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ status: 'error', message: 'No se envió ningún campo para actualizar.' });
        }

        const { data, error } = await supabase
            .from('matches')
            .update(patch)
            .eq('id', id)
            .select();

        if (error) {
            if (isMissingDetailsColumn(error)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Falta aplicar la migración 003_match_details.sql para guardar competencia y jornada.'
                });
            }
            return res.status(400).json({
                status: 'error',
                message: 'Error al actualizar el partido en la base de datos.',
                detail: error.message
            });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'El partido especificado no existe o no pudo ser encontrado.'
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Partido actualizado exitosamente.',
            data: data[0]
        });

    } catch (err) {
        return res.status(500).json({
            status: 'error',
            message: 'Error interno en el servidor al procesar la actualización.',
            error: err.message
        });
    }
};

const deleteMatch = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Se requiere el identificador del partido para la eliminación.'
            });
        }

        const { data: existing } = await supabase
            .from('matches')
            .select('id, tenant_id')
            .eq('id', id)
            .maybeSingle();

        if (!existing) {
            return res.status(404).json({
                status: 'error',
                message: 'El partido a eliminar no fue encontrado.'
            });
        }

        if (req.user.role !== 'superadmin' && existing.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({
                status: 'error',
                message: 'Este partido pertenece a otro club.'
            });
        }

        const { data: zones } = await supabase
            .from('zones')
            .select('id')
            .eq('match_id', id);

        if (zones && zones.length > 0) {
            const zoneIds = zones.map(z => z.id);
            const { count } = await supabase
                .from('tickets')
                .select('id', { count: 'exact', head: true })
                .in('zone_id', zoneIds);

            if (count > 0) {
                return res.status(409).json({
                    status: 'error',
                    message: `No se puede eliminar el partido: tiene ${count} entrada(s) vendida(s).`
                });
            }

            const { error: zoneError } = await supabase
                .from('zones')
                .delete()
                .eq('match_id', id);

            if (zoneError) {
                return res.status(400).json({
                    status: 'error',
                    message: 'No se pudieron eliminar las zonas del partido.',
                    detail: zoneError.message
                });
            }
        }

        const { data, error } = await supabase
            .from('matches')
            .delete()
            .eq('id', id)
            .select();

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'No se pudo eliminar el partido debido a restricciones de integridad.',
                detail: error.message
            });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'El partido a eliminar no fue encontrado.'
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Partido eliminado exitosamente del sistema.',
            data: data[0]
        });

    } catch (err) {
        return res.status(500).json({
            status: 'error',
            message: 'Error crítico en el servidor durante la eliminación.',
            error: err.message
        });
    }
};

const getMatchById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('matches')
            .select('*, tenants(name, slug)')
            .eq('id', id)
            .single();

        if (error || !data) {
            return res.status(404).json({ status: 'error', message: 'Partido no encontrado.' });
        }

        return res.status(200).json({ status: 'success', data });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: err.message });
    }
};

const getMatchZones = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('zones')
            .select('*')
            .eq('match_id', id)
            .order('price', { ascending: true });

        if (error) {
            return res.status(400).json({ status: 'error', message: error.message });
        }

        return res.status(200).json({ status: 'success', data });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Error interno del servidor', error: err.message });
    }
};

module.exports = {
    getMatches,
    createMatch,
    updateMatch,
    deleteMatch,
    getMatchById,
    getMatchZones
};