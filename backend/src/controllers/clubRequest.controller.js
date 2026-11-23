const crypto = require('crypto');
const { supabase } = require('../config/supabase');

const slugify = (text) =>
    text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCEPTED_MESSAGE = 'Solicitud recibida. Guarda el código privado que se mostrará para consultar el resultado; todavía no se crea el club ni se asignan permisos.';
const STATUS_TOKEN_RE = /^[a-f0-9]{64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_REQUEST_COLUMNS = [
    'id',
    'contact_email',
    'contact_name',
    'club_name',
    'slug',
    'logo_url',
    'stadium_name',
    'stadium_capacity',
    'association_id',
    'department',
    'personeria',
    'run_code',
    'status',
    'created_at',
    'privacy_consent_at',
    'reviewed_at',
    'reviewed_by',
    'review_note',
    'tenant_id',
    'associations(code, name)'
].join(', ');

const registerClub = async (req, res) => {
    try {
        const {
            contact_email,
            contact_name,
            club_name,
            logo_url,
            stadium_name,
            stadium_capacity,
            association_id,
            department,
            personeria,
            run_code,
            privacy_consent
        } = req.body || {};

        const cleanEmail = typeof contact_email === 'string' ? contact_email.trim().toLowerCase() : '';
        const cleanContactName = typeof contact_name === 'string' ? contact_name.trim() : '';
        const cleanClubName = typeof club_name === 'string' ? club_name.trim() : '';
        const cleanStadiumName = typeof stadium_name === 'string' ? stadium_name.trim() : '';
        const cleanDepartment = typeof department === 'string' ? department.trim() : '';
        const cleanPersoneria = typeof personeria === 'string' ? personeria.trim() : '';
        const cleanRunCode = typeof run_code === 'string' ? run_code.trim() : '';
        const cleanLogoUrl = typeof logo_url === 'string' ? logo_url.trim() : '';
        const capacity = Number(stadium_capacity);
        const finalSlug = slugify(cleanClubName);
        const statusToken = crypto.randomBytes(32).toString('hex');

        if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254 ||
            !cleanContactName || cleanContactName.length > 150 ||
            !/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]*$/.test(cleanContactName) ||
            !cleanClubName || cleanClubName.length > 150 ||
            !cleanStadiumName || cleanStadiumName.length > 150 ||
            !Number.isSafeInteger(capacity) || capacity < 1 || capacity > 2147483647 ||
            typeof association_id !== 'string' || !UUID_RE.test(association_id) ||
            !cleanDepartment || cleanDepartment.length > 100 ||
            cleanPersoneria.length > 100 || cleanRunCode.length > 100 ||
            !finalSlug || privacy_consent !== true) {
            return res.status(400).json({
                status: 'error',
                message: 'Completa correctamente los datos requeridos y acepta el uso de datos para revisar la solicitud.'
            });
        }

        const { data: association, error: associationError } = await supabase
            .from('associations')
            .select('id')
            .eq('id', association_id)
            .maybeSingle();

        if (associationError) throw associationError;
        if (!association) {
            return res.status(400).json({ status: 'error', message: 'La asociación indicada no existe.' });
        }

        const { data: existingTenant, error: tenantError } = await supabase
            .from('tenants')
            .select('id, is_active, association_id')
            .eq('slug', finalSlug)
            .maybeSingle();

        if (tenantError) throw tenantError;
        if (existingTenant &&
            (existingTenant.is_active || existingTenant.association_id !== association_id)) {
            return res.status(409).json({
                status: 'error',
                message: 'Ya existe un club activo o asociado de forma distinta con ese nombre.'
            });
        }

        const { error: requestError } = await supabase
            .from('club_requests')
            .insert([{
                contact_email: cleanEmail,
                contact_name: cleanContactName,
                club_name: cleanClubName,
                slug: finalSlug,
                logo_url: cleanLogoUrl || null,
                stadium_name: cleanStadiumName,
                stadium_capacity: capacity,
                association_id,
                department: cleanDepartment,
                personeria: cleanPersoneria || null,
                run_code: cleanRunCode || null,
                status: 'pending',
                status_token_hash: crypto.createHash('sha256').update(statusToken).digest('hex')
            }]);

        if (requestError?.code === '23505') {
            return res.status(409).json({
                status: 'error',
                message: 'Ya existe una solicitud o un club con información similar.'
            });
        }
        if (requestError) throw requestError;

        return res.status(202).json({
            status: 'success',
            message: ACCEPTED_MESSAGE,
            data: { status: 'pending', status_token: statusToken }
        });
    } catch (error) {
        console.error('[ClubRequest] No se pudo procesar la solicitud:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'No se pudo procesar la solicitud. Intenta nuevamente más tarde.'
        });
    }
};

const getClubRequestStatus = async (req, res) => {
    try {
        const statusToken = typeof req.body?.status_token === 'string'
            ? req.body.status_token.trim().toLowerCase()
            : '';

        if (!STATUS_TOKEN_RE.test(statusToken)) {
            return res.status(400).json({ status: 'error', message: 'El código de consulta no es válido.' });
        }

        const tokenHash = crypto.createHash('sha256').update(statusToken).digest('hex');
        const { data, error } = await supabase
            .from('club_requests')
            .select('status, reviewed_at, review_note')
            .eq('status_token_hash', tokenHash)
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ status: 'error', message: 'No se encontró una solicitud con ese código.' });
        }

        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        console.error('[ClubRequest] No se pudo consultar el estado:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'No se pudo consultar el estado. Intenta nuevamente más tarde.'
        });
    }
};

const getClubRequests = async (req, res) => {
    try {
        let query = supabase
            .from('club_requests')
            .select(ADMIN_REQUEST_COLUMNS)
            .order('created_at', { ascending: false });

        if (req.query.status) {
            if (!['pending', 'approved', 'rejected'].includes(req.query.status)) {
                return res.status(400).json({ status: 'error', message: 'Estado de solicitud inválido.' });
            }
            query = query.eq('status', req.query.status);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        console.error('[ClubRequest] No se pudieron obtener las solicitudes:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Error al obtener las solicitudes.'
        });
    }
};

const resolveClubRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { decision, review_note } = req.body || {};
        const cleanNote = typeof review_note === 'string' ? review_note.trim() : '';

        if (!UUID_RE.test(id)) {
            return res.status(400).json({ status: 'error', message: 'Identificador de solicitud inválido.' });
        }
        if (!['approved', 'rejected'].includes(decision)) {
            return res.status(400).json({ status: 'error', message: 'La decisión debe ser approved o rejected.' });
        }
        if (decision === 'rejected' && !cleanNote) {
            return res.status(400).json({ status: 'error', message: 'Escribe el motivo que verá el solicitante para rechazar la solicitud.' });
        }
        if (cleanNote.length > 2000) {
            return res.status(400).json({ status: 'error', message: 'La nota no puede superar 2000 caracteres.' });
        }

        const { data, error } = await supabase.rpc('resolve_club_request', {
            p_request_id: id,
            p_decision: decision,
            p_review_note: cleanNote || null,
            p_reviewed_by: req.user.id
        });

        if (error) {
            const message = error.message || '';
            if (message.includes('CLUB_REQUEST_NOT_FOUND')) {
                return res.status(404).json({ status: 'error', message: 'No se encontró la solicitud.' });
            }
            if (message.includes('CLUB_REQUEST_ALREADY_RESOLVED')) {
                return res.status(409).json({ status: 'error', message: 'Esta solicitud ya fue resuelta.' });
            }
            if (message.includes('CLUB_SLUG_CONFLICT')) {
                return res.status(409).json({ status: 'error', message: 'Ya existe un club con ese identificador y otra asociación. No se modificó la solicitud.' });
            }
            if (message.includes('SUPERADMIN_REQUIRED')) {
                return res.status(403).json({ status: 'error', message: 'Solo un superadmin puede resolver solicitudes.' });
            }
            throw error;
        }

        return res.status(200).json({
            status: 'success',
            message: decision === 'approved'
                ? (data.tenant_reused ? 'Solicitud aprobada; se habilitó el club existente.' : 'Solicitud aprobada y club creado.')
                : 'Solicitud rechazada.',
            data
        });
    } catch (error) {
        console.error('[ClubRequest] No se pudo resolver la solicitud:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'No se pudo resolver la solicitud. Intenta nuevamente más tarde.'
        });
    }
};

module.exports = {
    registerClub,
    getClubRequests,
    getClubRequestStatus,
    resolveClubRequest
};
