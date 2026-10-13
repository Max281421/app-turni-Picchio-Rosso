import React, { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle2, AlertCircle, Smartphone, Send, X } from 'lucide-react';
import {
  isPushSupported,
  getNotificationPermission,
  subscribeUserToPush,
  unsubscribeUserFromPush,
  sendTestPushNotification,
  getCurrentSubscription
} from '../lib/pushNotifications';
import { useAuth } from '../context/AuthContext';

export default function PushNotificationManager({ banner = false, onDismiss = null }) {
  const { currentEmployee, employee, user } = useAuth();
  const activeEmp = currentEmployee || employee;
  const empId = activeEmp?.id || activeEmp?.auth_user_id;
  const authUserId = user?.id || activeEmp?.auth_user_id;

  const [permission, setPermission] = useState('default');
  const [hasSubscription, setHasSubscription] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    const perm = getNotificationPermission();
    setPermission(perm);
    if (perm === 'granted') {
      getCurrentSubscription().then(sub => {
        setHasSubscription(Boolean(sub));
      });
    }
  }, []);

  const handleEnablePush = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      await subscribeUserToPush(empId, authUserId);
      const perm = getNotificationPermission();
      setPermission(perm);
      setHasSubscription(true);
      setStatusMsg({
        type: 'success',
        text: '🔔 Notifiche attivate con successo! Riceverai un avviso sullo schermo appena l\'Admin confermerà i tuoi turni.'
      });
    } catch (err) {
      console.error('Errore attivazione push:', err);
      const perm = getNotificationPermission();
      setPermission(perm);
      setStatusMsg({ type: 'error', text: err.message || 'Impossibile attivare le notifiche.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisablePush = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      await unsubscribeUserFromPush(empId);
      const perm = getNotificationPermission();
      setPermission(perm);
      setHasSubscription(false);
      setStatusMsg({ type: 'info', text: 'Notifiche disattivate per questo dispositivo.' });
    } catch (err) {
      console.error('Errore disattivazione push:', err);
      setStatusMsg({ type: 'error', text: 'Errore durante la disattivazione.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestLoading(true);
    setStatusMsg(null);
    try {
      await sendTestPushNotification();
      setStatusMsg({
        type: 'success',
        text: '📲 Notifica di test inviata! Controlla la tendina delle notifiche del tuo telefono.'
      });
    } catch (err) {
      console.error('Errore invio push di test:', err);
      setStatusMsg({
        type: 'error',
        text: err.message || 'Errore invio notifica di prova.'
      });
    } finally {
      setTestLoading(false);
    }
  };

  if (!isPushSupported()) {
    if (banner) return null; // Don't annoy unsupported devices with a banner
    return (
      <div className="glass-card" style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem' }}>
          <Smartphone size={16} />
          <span>Le notifiche push non sono supportate da questo browser o dispositivo. Su iPhone è necessario aggiungere il sito alla schermata Home.</span>
        </div>
      </div>
    );
  }

  // MODALITÀ BANNER (in cima alle schermate)
  if (banner) {
    if (permission === 'granted' && hasSubscription) return null; // Già abilitate, non mostrare il banner
    if (permission === 'denied') return null; // Bloccate dal browser, non insistere con il banner

    return (
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.18) 0%, rgba(99, 102, 241, 0.18) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '12px',
          padding: '12px 14px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bell size={18} color="#38bdf8" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>
                Attiva le Notifiche dei Turni
              </div>
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.3 }}>
                Ricevi un avviso sullo schermo non appena l'Admin conferma il planning del tuo settore!
              </div>
            </div>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Ignora per ora"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {statusMsg && (
          <div
            style={{
              fontSize: '0.8rem',
              padding: '6px 10px',
              borderRadius: '6px',
              background: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: statusMsg.type === 'success' ? '#34d399' : '#f87171',
              fontWeight: 600,
            }}
          >
            {statusMsg.text}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleEnablePush}
            disabled={loading}
            className="btn-primary"
            style={{
              padding: '7px 14px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontWeight: 700,
              flex: 1,
            }}
          >
            <Bell size={14} />
            {loading ? 'Attivazione in corso...' : 'Attiva Notifiche Ora'}
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                padding: '7px 12px',
                fontSize: '0.82rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              Più tardi
            </button>
          )}
        </div>
      </div>
    );
  }

  // MODALITÀ SCHEDA COMPLETA (in Gestione Profilo)
  const isFullyActive = permission === 'granted' && hasSubscription;

  return (
    <div
      className="glass-card"
      style={{
        padding: '16px',
        borderRadius: '12px',
        background: isFullyActive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(56, 189, 248, 0.08)',
        border: isFullyActive ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(56, 189, 248, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={18} color={isFullyActive ? '#34d399' : '#38bdf8'} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>
            Notifiche Turni Confermati
          </span>
        </div>

        {isFullyActive ? (
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={12} /> ATTIVE
          </span>
        ) : (
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 8px', borderRadius: '10px' }}>
            NON ATTIVE
          </span>
        )}
      </div>

      <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
        {isFullyActive
          ? 'Questo telefono riceverà un avviso push ogni volta che l\'Admin confermerà i turni della settimana per il tuo settore (Cassa, Fattorino o Pizzeria).'
          : 'Ricevi un avviso push sullo schermo del telefono quando l\'Admin conferma i turni della settimana per la tua mansione.'}
      </p>

      {permission === 'denied' && (
        <div style={{ fontSize: '0.75rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AlertCircle size={14} flexShrink={0} />
          <span>Le notifiche risultano bloccate nel browser. Abilita i permessi nelle impostazioni del sito per questo dispositivo.</span>
        </div>
      )}

      {statusMsg && (
        <div
          style={{
            fontSize: '0.8rem',
            padding: '8px 12px',
            borderRadius: '8px',
            background: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : statusMsg.type === 'info' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: statusMsg.type === 'success' ? '#34d399' : statusMsg.type === 'info' ? '#38bdf8' : '#f87171',
            fontWeight: 600,
          }}
        >
          {statusMsg.text}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {!isFullyActive ? (
          <button
            onClick={handleEnablePush}
            disabled={loading}
            className="btn-primary"
            style={{
              padding: '9px 14px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontWeight: 700,
            }}
          >
            <Bell size={15} />
            {loading ? 'Attivazione in corso...' : 'Attiva Notifiche su questo Telefono'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={handleSendTestPush}
              disabled={testLoading}
              style={{
                flex: 1,
                minWidth: '150px',
                padding: '8px 12px',
                fontSize: '0.8rem',
                borderRadius: '8px',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontWeight: 600,
              }}
            >
              <Send size={14} />
              {testLoading ? 'Invio test...' : '🔔 Invia Notifica di Prova'}
            </button>
            <button
              onClick={handleDisablePush}
              disabled={loading}
              style={{
                padding: '8px 12px',
                fontSize: '0.8rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <BellOff size={14} />
              {loading ? 'Disattivazione...' : 'Disattiva'}
            </button>
          </div>
        )}
      </div>

      <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
        💡 Su iPhone (iOS): Assicurati di aver salvato l'app sulla schermata Home ("Aggiungi a Schermata Home") da Safari affinché le notifiche Web Push possano funzionare.
      </div>
    </div>
  );
}
