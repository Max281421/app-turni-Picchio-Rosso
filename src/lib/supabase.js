import { createClient } from '@supabase/supabase-js';

export function cleanSupabaseUrl(rawUrl) {
  if (!rawUrl) return '';
  let str = rawUrl.trim();

  // Se l'utente ha incollato il link della dashboard (es. https://supabase.com/dashboard/project/abcdefgh/settings/api)
  const dashboardMatch = str.match(/dashboard\/project\/([a-zA-Z0-9_-]+)/i);
  if (dashboardMatch && dashboardMatch[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  try {
    const parsed = new URL(str);
    return parsed.origin;
  } catch (e) {
    return str.replace(/\/+$/, '');
  }
}

// Lettura/scrittura sicura per Safari iOS e modalità anonima
function safeLocalStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function safeLocalStorageSet(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch (e) {}
}

function safeLocalStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {}
}

// Memoria condivisa globale per credenziali di fallback del progetto
let fallbackUrl = 'https://anipnkftlyemgpulycqo.supabase.co';
let fallbackKey = 'sb_publishable_sOd-X1rlfMbyBwJ2tVdbUw_Q3tZf-oi';

export function getSupabaseCredentials() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const localUrl = safeLocalStorageGet('APP_TURNI_SUPABASE_URL');
  const localKey = safeLocalStorageGet('APP_TURNI_SUPABASE_KEY');

  const rawUrl = envUrl || localUrl || fallbackUrl || '';
  const url = cleanSupabaseUrl(rawUrl);
  const key = (envKey || localKey || fallbackKey || '').trim();

  return { url, key, isConfigured: Boolean(url && key) };
}

let supabaseInstance = null;

export function getSupabaseClient() {
  const { url, key } = getSupabaseCredentials();

  if (!url || !key) {
    return null;
  }

  if (!supabaseInstance || supabaseInstance.supabaseUrl !== url) {
    supabaseInstance = createClient(url, key);
  }

  return supabaseInstance;
}

export function saveSupabaseConfig(url, key) {
  const cleanedUrl = cleanSupabaseUrl(url);
  const cleanedKey = key.trim();

  fallbackUrl = cleanedUrl;
  fallbackKey = cleanedKey;

  safeLocalStorageSet('APP_TURNI_SUPABASE_URL', cleanedUrl);
  safeLocalStorageSet('APP_TURNI_SUPABASE_KEY', cleanedKey);
  supabaseInstance = createClient(cleanedUrl, cleanedKey);
}

export function clearSupabaseConfig() {
  safeLocalStorageRemove('APP_TURNI_SUPABASE_URL');
  safeLocalStorageRemove('APP_TURNI_SUPABASE_KEY');
  fallbackUrl = '';
  fallbackKey = '';
  supabaseInstance = null;
}
