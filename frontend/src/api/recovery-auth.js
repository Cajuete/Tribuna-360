import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const initialCallbackParams = new URLSearchParams(window.location.hash.slice(1));

export const recoveryCallbackType = initialCallbackParams.get('type');
export const recoveryCallbackError = initialCallbackParams.get('error_description');
export const recoveryClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: true,
        persistSession: false,
      },
    })
  : null;
