const { supabase, supabaseAuth } = require('../config/supabase');

const slugify = (text) =>
    text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const registerClub = async (req, res) => {
    let createdAuthUser = null;
    let createdTenant = null;

    try {
        const {
            contact_email,
            full_name,
            password,
            club_name,
            slug,
            logo_url,
            stadium_name,
            stadium_capacity,
            association_id,
            department,
            personeria,
            run_code
        } = req.body;

        const capacity = Number.parseInt(stadium_capacity, 10);

        if (!contact_email || !EMAIL_RE.test(contact_email) || !club_name || !stadium_name ||
            !Number.isInteger(capacity) || capacity < 1 || !association_id || !department) {
            return res.status(400).json({
                status: 'error',
                message: 'Datos del club inválidos: correo, nombre, estadio, capacidad, asociación y departamento son requeridos.'
            });
        }

        if (!full_name || !password || password.length < 6) {
            return res.status(400).json({
                status: 'error',
                message: 'Datos de la cuenta inválidos: nombre y contraseña (mínimo 6 caracteres) son requeridos.'
            });
        }

        const { data: association } = await supabase
            .from('associations')
            .select('id')
            .eq('id', association_id)
            .maybeSingle();

        if (!association) {
            return res.status(404).json({ status: 'error', message: 'La asociación indicada no existe.' });
        }

        const finalSlug = slugify(slug || club_name);
        if (!finalSlug) {
            return res.status(400).json({ status: 'error', message: 'No se pudo generar un slug válido para el club.' });
        }

        const { data: dupTenant } = await supabase
            .from('tenants')
            .select('id')
            .eq('slug', finalSlug)
            .maybeSingle();

        if (dupTenant) {
            return res.status(409).json({ status: 'error', message: 'Ya existe un club con ese nombre en la plataforma.' });
        }

        // 1) Cuenta de autenticación del futuro administrador
        const { data: authData, error: authError } = await supabaseAuth.auth.admin.createUser({
            email: contact_email.trim(),
            password,
            email_confirm: true,
            user_metadata: { full_name: full_name.trim() }
        });

        if (authError) {
            if (authError.code === 'email_exists' || /already (been )?registered/i.test(authError.message || '')) {
                return res.status(409).json({ status: 'error', message: 'Ese correo ya tiene una cuenta. Inicia sesión o usa otro correo.' });
            }
            throw authError;
        }
        createdAuthUser = authData.user;

        // 2) El club
        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .insert([{
                name: club_name.trim(),
                slug: finalSlug,
                logo_url: logo_url || null,
                stadium_name: stadium_name.trim(),
                stadium_capacity: capacity,
                association_id,
                department,
                personeria: personeria || null,
                run_code: run_code || null
            }])
            .select()
            .single();

        if (tenantError) {
            await supabaseAuth.auth.admin.deleteUser(createdAuthUser.id).catch(() => {});
            if (tenantError.code === '23505') {
                return res.status(409).json({ status: 'error', message: 'Ya existe un club con ese nombre o slug.' });
            }
            throw tenantError;
        }
        createdTenant = tenant;

        // 3) Usuario admin del club
        const { data: dbUser, error: userError } = await supabase
            .from('users')
            .insert([{
                auth_user_id: createdAuthUser.id,
                tenant_id: tenant.id,
                email: contact_email.trim(),
                full_name: full_name.trim(),
                role: 'club_admin'
            }])
            .select('id, email, full_name, role, tenant_id')
            .single();

        if (userError) {
            await supabase.from('tenants').delete().eq('id', tenant.id).catch(() => {});
            await supabaseAuth.auth.admin.deleteUser(createdAuthUser.id).catch(() => {});
            throw userError;
        }

        // 4) Historial de la solicitud (aprobada por validación del sistema)
        const { error: requestError } = await supabase
            .from('club_requests')
            .insert([{
                contact_email: contact_email.trim(),
                club_name: club_name.trim(),
                slug: finalSlug,
                logo_url: logo_url || null,
                stadium_name: stadium_name.trim(),
                stadium_capacity: capacity,
                association_id,
                department,
                personeria: personeria || null,
                run_code: run_code || null,
                status: 'approved',
                review_note: 'Auto-aprobada por validación del sistema'
            }]);

        if (requestError) {
            // el club ya quedó operativo; el historial es best-effort
            console.error('No se pudo registrar el historial de la solicitud:', requestError.message);
        }

        return res.status(201).json({
            status: 'success',
            message: `¡Club "${tenant.name}" publicado en Tribuna 360! Ya puedes iniciar sesión con ${contact_email.trim()}.`,
            data: { tenant, user: dbUser }
        });
    } catch (error) {
        if (createdAuthUser && !createdTenant) {
            await supabaseAuth.auth.admin.deleteUser(createdAuthUser.id).catch(() => {});
        }
        return res.status(500).json({ status: 'error', message: 'Error al registrar el club', error: error.message });
    }
};

const getClubRequests = async (req, res) => {
    try {
        let query = supabase
            .from('club_requests')
            .select('*, associations(code, name)')
            .order('created_at', { ascending: false });

        if (req.query.status) {
            query = query.eq('status', req.query.status);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.status(200).json({ status: 'success', data });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener las solicitudes', error: error.message });
    }
};

module.exports = {
    registerClub,
    getClubRequests
};
