import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[ERROR] Faltan las credenciales de Supabase en el archivo .env del backend.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);