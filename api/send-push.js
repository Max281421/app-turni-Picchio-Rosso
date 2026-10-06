import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || 'BGX-1Wgk8a7CYOWhjBHZ0dl4k52iT3NN2MS1SJyxcF4SJI8fnhz552M9OVArdb8WPdU9J-y_wYIt2wRpxE_WdVI';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'Lf4J_22GxC746EhgL_OmJnmQCI7RUtS5FpNRKfAzJgo';

try {
  webpush.setVapidDetails(
    'mailto:admin@app-turni.local',
    vapidPublicKey,
    vapidPrivateKey
  );
} catch (e) {
  console.warn('Errore inizializzazione VAPID details:', e);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  try {
    const { sectorId, sectorLabel, weekStartStr, weekEndStr, employeeIds } = req.body || {};

    if (!sectorId || !employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ error: 'Parametri mancanti per l\'invio delle notifiche push' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://anipnkftlyemgpulycqo.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_sOd-X1rlfMbyBwJ2tVdbUw_Q3tZf-oi';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Recupera le sottoscrizioni push per i dipendenti di questo settore
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('employee_id', employeeIds);

    if (error || !subs || subs.length === 0) {
      return res.status(200).json({ success: true, count: 0, message: 'Nessun dispositivo iscritto per questo settore.' });
    }

    const label = sectorLabel || (sectorId === 'cassa' ? 'Cassa 💵' : sectorId === 'fattorino' ? 'Fattorino 🛵' : 'Pizzeria 🍕');
    
    const payload = JSON.stringify({
      title: `Planning ${label} Confermato! 📅`,
      body: `I turni di ${label} per la settimana dal ${weekStartStr} al ${weekEndStr} sono stati pubblicati dall'Admin. Tocca per vederli!`,
      url: '/',
      tag: `planning-${sectorId}`
    });

    const results = await Promise.allSettled(
      subs.map(async (s) => {
        const pushSubscription = {
          endpoint: s.endpoint,
          keys: {
            p256dh: s.p256dh,
            auth: s.auth
          }
        };
        try {
          await webpush.sendNotification(pushSubscription, payload);
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Sottoscrizione scaduta o non più valida: rimozione da DB
            await supabase.from('push_subscriptions').delete().eq('id', s.id);
          }
          throw err;
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    return res.status(200).json({ success: true, count: successCount, total: subs.length });
  } catch (err) {
    console.error('Errore durante l\'invio delle notifiche push:', err);
    return res.status(500).json({ error: err.message || 'Errore interno server notifiche' });
  }
}
