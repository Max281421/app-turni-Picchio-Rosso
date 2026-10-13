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

export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch (e) {
    return null;
  }
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
    throw new Error('Permesso notifiche non concesso. Abilita le notifiche nelle impostazioni del browser.');
  }

  // Assicurati che il Service Worker sia registrato e pronto
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
    let resolvedEmployeeId = null;
    let resolvedAuthUserId = authUserId || null;

    // Risolvi il corretto ID di employees per evitare violazioni di chiave esterna (foreign key 23503)
    try {
      const idsToCheck = [employeeId, authUserId].filter(Boolean);
      if (idsToCheck.length > 0) {
        const orFilter = idsToCheck.map(id => `id.eq.${id},auth_user_id.eq.${id}`).join(',');
        const { data: matchedEmp } = await supabase
          .from('employees')
          .select('id, auth_user_id')
          .or(orFilter)
          .limit(1)
          .maybeSingle();

        if (matchedEmp) {
          resolvedEmployeeId = matchedEmp.id;
          resolvedAuthUserId = matchedEmp.auth_user_id || resolvedAuthUserId;
        }
      }
    } catch (resErr) {
      console.warn('Errore risoluzione dipendente durante salvataggio push:', resErr);
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        employee_id: resolvedEmployeeId,
        auth_user_id: resolvedAuthUserId,
        endpoint,
        p256dh,
        auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      console.error('Errore salvataggio sottoscrizione push su Supabase:', error);
      throw new Error(`Errore registrazione sul database: ${error.message}`);
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
 * Invia una notifica di test istantanea al dispositivo corrente
 */
export async function sendTestPushNotification() {
  if (!isPushSupported()) {
    throw new Error('Notifiche push non supportate su questo dispositivo.');
  }

  const subscription = await getCurrentSubscription();
  if (!subscription) {
    throw new Error('Nessuna sottoscrizione attiva su questo dispositivo. Attiva prima le notifiche con il pulsante verde.');
  }

  const response = await fetch('/api/send-push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      isTest: true,
      subscription: subscription.toJSON(),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Impossibile inviare la notifica di test dal server.');
  }

  return data;
}

/**
 * Recupera le statistiche dei dipendenti e dispositivi iscritti per un determinato settore
 */
export async function getSectorSubscriberInfo(sectorId) {
  const supabase = getSupabaseClient();
  if (!supabase || !sectorId) {
    return { totalEmployees: 0, subscribedDevices: 0, subscribedEmployees: 0, employeeNames: [] };
  }

  try {
    const { data: dbEmployees, error: empErr } = await supabase
      .from('employees')
      .select('id, nome, auth_user_id, mansioni');

    if (empErr || !dbEmployees) {
      return { totalEmployees: 0, subscribedDevices: 0, subscribedEmployees: 0, employeeNames: [] };
    }

    const sectorLower = sectorId.toLowerCase().trim();
    const sectorEmployees = dbEmployees.filter(e => {
      let mList = [];
      if (Array.isArray(e.mansioni)) {
        mList = e.mansioni.map(m => m.toLowerCase().trim());
      } else if (typeof e.mansioni === 'string') {
        mList = e.mansioni.toLowerCase().split(',').map(m => m.trim());
      }
      return mList.includes(sectorLower);
    });

    if (sectorEmployees.length === 0) {
      return { totalEmployees: 0, subscribedDevices: 0, subscribedEmployees: 0, employeeNames: [] };
    }

    const empIds = sectorEmployees.map(e => e.id).filter(Boolean);
    const authIds = sectorEmployees.map(e => e.auth_user_id).filter(Boolean);
    const allIds = [...new Set([...empIds, ...authIds])];

    if (allIds.length === 0) {
      return { totalEmployees: sectorEmployees.length, subscribedDevices: 0, subscribedEmployees: 0, employeeNames: sectorEmployees.map(e => e.nome) };
    }

    const orQuery = allIds.map(id => `employee_id.eq.${id},auth_user_id.eq.${id}`).join(',');
    const { data: subs, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('id, employee_id, auth_user_id')
      .or(orQuery);

    if (subErr || !subs) {
      return { totalEmployees: sectorEmployees.length, subscribedDevices: 0, subscribedEmployees: 0, employeeNames: sectorEmployees.map(e => e.nome) };
    }

    const subscribedEmpIdSet = new Set();
    subs.forEach(s => {
      sectorEmployees.forEach(e => {
        if (s.employee_id === e.id || s.auth_user_id === e.auth_user_id || s.auth_user_id === e.id) {
          subscribedEmpIdSet.add(e.id);
        }
      });
    });

    return {
      totalEmployees: sectorEmployees.length,
      subscribedDevices: subs.length,
      subscribedEmployees: subscribedEmpIdSet.size,
      employeeNames: sectorEmployees.map(e => e.nome),
    };
  } catch (err) {
    console.warn('Errore getSectorSubscriberInfo:', err);
    return { totalEmployees: 0, subscribedDevices: 0, subscribedEmployees: 0, employeeNames: [] };
  }
}

/**
 * Invia una notifica push per il settore confermato dall'Admin
 */
export async function triggerPushForSectorPublish(sectorId, sectorLabel, weekStartStr, weekEndStr) {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, count: 0, error: 'Database non connesso' };

  try {
    // 1. Recupera tutti i dipendenti che hanno il settore specificato nelle loro mansioni
    const { data: dbEmployees, error: dbErr } = await supabase
      .from('employees')
      .select('id, auth_user_id, mansioni');

    if (dbErr) throw dbErr;
    if (!dbEmployees || dbEmployees.length === 0) {
      return { success: true, count: 0, total: 0, totalEmployees: 0, message: 'Nessun dipendente censito.' };
    }

    const sectorLower = sectorId.toLowerCase().trim();
    const targetEmployeeIds = [];
    const targetAuthUserIds = [];

    dbEmployees.forEach(e => {
      let mList = [];
      if (Array.isArray(e.mansioni)) {
        mList = e.mansioni.map(m => m.toLowerCase().trim());
      } else if (typeof e.mansioni === 'string') {
        mList = e.mansioni.toLowerCase().split(',').map(m => m.trim());
      }

      if (mList.includes(sectorLower)) {
        if (e.id) targetEmployeeIds.push(e.id);
        if (e.auth_user_id) targetAuthUserIds.push(e.auth_user_id);
      }
    });

    if (targetEmployeeIds.length === 0 && targetAuthUserIds.length === 0) {
      return { success: true, count: 0, total: 0, totalEmployees: 0, message: 'Nessun dipendente appartiene a questo settore.' };
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
        authUserIds: targetAuthUserIds,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, count: 0, error: data.error || `Errore HTTP ${response.status}` };
    }

    return data;
  } catch (err) {
    console.error('Errore invio notifiche push settore:', err);
    return { success: false, count: 0, error: err.message };
  }
}
