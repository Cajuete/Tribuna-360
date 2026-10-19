const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
    console.error('[ERROR] Faltan las credenciales de Supabase en el archivo .env del backend.');
}

if (!SERVICE_ROLE_KEY) {
    console.warn('[AVISO] Falta SUPABASE_SERVICE_ROLE_KEY en .env: se usará la anon key y el RLS bloqueará lecturas/escrituras.');
}

const commonOptions = { auth: { persistSession: false, autoRefreshToken: false } };

// Cliente para consultas a la base de datos: SIEMPRE usa la service key.
// NUNCA ejecutar signInWithPassword sobre este cliente (dejaría la sesión
// del usuario en memoria y todas las consultas posteriores pasarían por RLS).
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || ANON_KEY, commonOptions);

// Cliente exclusivo para operaciones de sesión (signInWithPassword).
const supabaseAuth = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || ANON_KEY, commonOptions);

module.exports = { supabase, supabaseAuth };
