import React, { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react';
import { isPushSupported, getNotificationPermission, subscribeUserToPush, unsubscribeUserFromPush } from '../lib/pushNotifications';
import { useAuth } from '../context/AuthContext';

export default function PushNotificationManager({ inline = false }) {
  const { currentEmployee, employee, user } = useAuth();
  const activeEmp = currentEmployee || employee;
  const empId = activeEmp?.id || activeEmp?.auth_user_id;
  const authUserId = user?.id || activeEmp?.auth_user_id;

  const [permission, setPermission] = useState('default');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const handleEnablePush = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      await subscribeUserToPush(empId, authUserId);
      setPermission(getNotificationPermission());
      setStatusMsg({ type: 'success', text: '🔔 Notifiche attivate con successo! Riceverai un avviso quando i tuoi turni saranno confermati.' });
    } catch (err) {
      console.error('Errore attivazione push:', err);
      setPermission(getNotificationPermission());
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
      setPermission(getNotificationPermission());
      setStatusMsg({ type: 'info', text: 'Notifiche disattivate per questo dispositivo.' });
    } catch (err) {
      console.error('Errore disattivazione push:', err);
      setStatusMsg({ type: 'error', text: 'Errore durante la disattivazione.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isPushSupported()) {
    return (
      <div className="glass-card" style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem' }}>
          <Smartphone size={16} />
          <span>Le notifiche push non sono supportate da questo browser o dispositivo.</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="glass-card"
      style={{
        padding: '16px',
        borderRadius: '12px',
        background: permission === 'granted' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(56, 189, 248, 0.08)',
        border: permission === 'granted' ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(56, 189, 248, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={18} color={permission === 'granted' ? '#34d399' : '#38bdf8'} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>
            Notifiche Turni Confermati
          </span>
        </div>

        {permission === 'granted' ? (
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
        {permission === 'granted'
          ? 'Riceverai una notifica automatica sullo schermo dello smartphone ogni volta che l\'Admin conferma i turni per il tuo settore (Cassa, Fattorino o Pizzeria).'
          : 'Ricevi un avviso sullo schermo del telefono quando l\'Admin conferma i turni della settimana per la tua mansione.'}
      </p>

      {permission === 'denied' && (
        <div style={{ fontSize: '0.75rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AlertCircle size={14} flexShrink={0} />
          <span>Le notifiche risultano bloccate nelle impostazioni del browser. Sblocca i permessi nelle impostazioni del sito.</span>
        </div>
      )}

      {statusMsg && (
        <div
          style={{
            fontSize: '0.8rem',
            padding: '8px 12px',
            borderRadius: '8px',
            background: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: statusMsg.type === 'success' ? '#34d399' : '#f87171',
            fontWeight: 600,
          }}
        >
          {statusMsg.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        {permission !== 'granted' ? (
          <button
            onClick={handleEnablePush}
            disabled={loading}
            className="btn-primary"
            style={{
              flex: 1,
              padding: '8px 14px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Bell size={15} />
            {loading ? 'Attivazione...' : 'Attiva Notifiche su questo Telefono'}
          </button>
        ) : (
          <button
            onClick={handleDisablePush}
            disabled={loading}
            style={{
              flex: 1,
              padding: '6px 12px',
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
            {loading ? 'Disattivazione...' : 'Disattiva Notifiche su questo Telefono'}
          </button>
        )}
      </div>

      <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
        💡 Su iPhone (iOS): Se l'opzione non è cliccabile, assicurati prima di aver salvato l'app sulla Home ("Aggiungi a Schermata Home").
      </div>
    </div>
  );
}
