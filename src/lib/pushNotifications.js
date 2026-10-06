import { getSupabaseClient } from './supabase';

export const VAPID_PUBLIC_KEY = 'BGX-1Wgk8a7CYOWhjBHZ0dl4k52iT3NN2MS1SJyxcF4SJI8fnhz552M9OVArdb8WPdU9J-y_wYIt2wRpxE_WdVI';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported() {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
}

export function getNotificationPermission() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Sottoscrive l'utente corrente alle notifiche push del browser
 */
export async function subscribeUserToPush(employeeId, authUserId) {
  if (!isPushSupported()) {
    throw new Error('Notifiche push non supportate da questo browser o dispositivo.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permesso notifiche rifiutato dall\'utente.');
  }

  // Assicurati che il Service Worker sia registrato
  let registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    registration = await navigator.serviceWorker.register('/sw.js');
  }

  await navigator.serviceWorker.ready;

  // Sottoscrivi a PushManager
  const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  const subJson = subscription.toJSON();
  const endpoint = subJson.endpoint;
  const p256dh = subJson.keys?.p256dh;
  const auth = subJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Impossibile ottenere le chiavi di crittografia per le notifiche.');
  }

  // Salva o aggiorna su Supabase (push_subscriptions)
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        employee_id: employeeId || null,
        auth_user_id: authUserId || null,
        endpoint,
        p256dh,
        auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      console.warn('Errore salvataggio sottoscrizione push su Supabase:', error);
    }
  }

  return subscription;
}

/**
 * Disattiva le notifiche push per il dispositivo corrente
 */
export async function unsubscribeUserFromPush(employeeId) {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    const supabase = getSupabaseClient();
    if (supabase && endpoint) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }
  }
}

/**
 * Invia una notifica push per il settore confermato dall'Admin
 */
export async function triggerPushForSectorPublish(sectorId, sectorLabel, weekStartStr, weekEndStr) {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, count: 0 };

  try {
    // 1. Recupera tutti i dipendenti che hanno il settore specificato nelle loro mansioni
    const { data: dbEmployees } = await supabase.from('employees').select('id, auth_user_id, mansioni');
    if (!dbEmployees || dbEmployees.length === 0) return { success: true, count: 0 };

    const targetEmployeeIds = [];
    dbEmployees.forEach(e => {
      let mList = [];
      if (Array.isArray(e.mansioni)) {
        mList = e.mansioni.map(m => m.toLowerCase().trim());
      } else if (typeof e.mansioni === 'string') {
        mList = e.mansioni.toLowerCase().split(',').map(m => m.trim());
      }

      if (mList.includes(sectorId.toLowerCase().trim())) {
        if (e.id) targetEmployeeIds.push(e.id);
      }
    });

    if (targetEmployeeIds.length === 0) {
      return { success: true, count: 0, message: 'Nessun dipendente appartiene a questo settore.' };
    }

    // 2. Invia la richiesta all'API endpoint /api/send-push
    const response = await fetch('/api/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sectorId,
        sectorLabel,
        weekStartStr,
        weekEndStr,
        employeeIds: targetEmployeeIds,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.warn('Risposta API send-push non OK:', errData);
      return { success: false, error: errData.error || 'Errore invio notifiche push' };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Errore invio notifiche push settore:', err);
    return { success: false, error: err.message };
  }
}
