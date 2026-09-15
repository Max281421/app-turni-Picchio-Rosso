import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { parseMansioni } from '../lib/whatsappExport';
import { Shield, User, X, Trash2, ArrowRightLeft, Check, AlertTriangle, UserCheck } from 'lucide-react';

export default function ProfileModal({ isOpen, onClose, targetEmployee = null, onUpdated = null }) {
  const { user, employee, updateEmployeeRole, updateEmployeeName, updateEmployeeAlias, updateEmployeeMansioni, deleteAccount } = useAuth();
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const activeEmp = targetEmployee || employee;
  const isSelf = !targetEmployee || (
    targetEmployee.id === employee?.id ||
    targetEmployee.auth_user_id === employee?.auth_user_id ||
    targetEmployee.id === user?.id
  );

  const currentUserIsAdmin = employee?.ruolo === 'admin';
  const targetIsAdmin = activeEmp?.ruolo === 'admin';

  const [editingName, setEditingName] = useState(activeEmp?.nome || '');
  const [editingAlias, setEditingAlias] = useState(activeEmp?.alias || '');
  const [editingMansioni, setEditingMansioni] = useState(parseMansioni(activeEmp?.mansioni, activeEmp?.id || activeEmp?.auth_user_id));
  const [nameSaved, setNameSaved] = useState(false);
  const [aliasSaved, setAliasSaved] = useState(false);
  const [mansioniSaved, setMansioniSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

  useEffect(() => {
    if (activeEmp) {
      setEditingName(activeEmp.nome || '');
      setEditingAlias(activeEmp.alias || '');
      setEditingMansioni(parseMansioni(activeEmp.mansioni, activeEmp.id || activeEmp.auth_user_id));
      setConfirmDelete(false);
    }
  }, [activeEmp?.id, activeEmp?.auth_user_id, activeEmp?.nome, activeEmp?.alias, activeEmp?.mansioni]);

  if (!isOpen || !user) return null;

  const targetId = activeEmp?.id || activeEmp?.auth_user_id;

  const handleSaveName = async () => {
    if (!targetId || !editingName.trim()) return;
    setLoading(true);
    try {
      await updateEmployeeName(targetId, editingName.trim());
      setNameSaved(true);
      if (onUpdated) await onUpdated();
      setTimeout(() => setNameSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Errore durante l\'aggiornamento del nome.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAlias = async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      await updateEmployeeAlias(targetId, editingAlias.trim());
      setAliasSaved(true);
      if (onUpdated) await onUpdated();
      setTimeout(() => setAliasSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Errore durante l\'aggiornamento dell\'alias.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMansione = (target) => {
    setEditingMansioni(prev => {
      if (prev.includes(target)) {
        return prev.filter(m => m !== target);
      } else {
        return [...prev, target];
      }
    });
  };

  const handleSaveMansioni = async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      await updateEmployeeMansioni(targetId, editingMansioni);
      if (activeEmp.auth_user_id && activeEmp.auth_user_id !== activeEmp.id) {
        await updateEmployeeMansioni(activeEmp.auth_user_id, editingMansioni);
      }
      setMansioniSaved(true);
      if (onUpdated) await onUpdated();
      setTimeout(() => setMansioniSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Errore durante l\'aggiornamento dei settori.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async () => {
    if (!targetId) return;
    setLoading(true);
    const newRole = targetIsAdmin ? 'dipendente' : 'admin';
    try {
      await updateEmployeeRole(targetId, newRole);
      if (onUpdated) await onUpdated();
      alert(`Ruolo di ${activeEmp.nome || 'Utente'} aggiornato a: ${newRole.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      alert('Errore durante il cambio ruolo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      await deleteAccount(targetId);
      if (onUpdated) await onUpdated();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Errore durante l\'eliminazione dell\'account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
        
        {/* Sticky Header for easy closing on scroll */}
        <div className="modal-header-sticky">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: targetIsAdmin ? 'rgba(56, 189, 248, 0.15)' : 'rgba(129, 140, 248, 0.15)', padding: '8px', borderRadius: '10px' }}>
              {targetIsAdmin ? <Shield size={22} color="#38bdf8" /> : <User size={22} color="#818cf8" />}
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                {isSelf ? 'Gestione Profilo Utente' : `Modifica Account: ${activeEmp?.nome || 'Dipendente'}`}
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>
                {activeEmp?.email || user.email}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#94a3b8',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Edit Name & Surname Section */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '16px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
            Nome e Cognome
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              placeholder="es. Mario Rossi"
              className="glass-input"
              style={{ flex: 1, padding: '10px 14px', fontSize: '0.9rem' }}
            />
            <button
              type="button"
              onClick={handleSaveName}
              disabled={loading || !editingName.trim()}
              className="btn-primary"
              style={{ padding: '10px 14px', fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {nameSaved ? <Check size={16} /> : <UserCheck size={16} />}
              {nameSaved ? 'Salvato!' : 'Salva'}
            </button>
          </div>
        </div>

        {/* Edit Alias / Soprannome WhatsApp Section */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '16px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
            Alias / Soprannome WhatsApp
          </label>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
            Usato nel messaggio WhatsApp del planning (es. "ALLE", "GIGI", "ROBY")
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={editingAlias}
              onChange={(e) => setEditingAlias(e.target.value)}
              placeholder="es. ALLE"
              className="glass-input"
              style={{ flex: 1, padding: '10px 14px', fontSize: '0.9rem' }}
            />
            <button
              type="button"
              onClick={handleSaveAlias}
              disabled={loading}
              className="btn-primary"
              style={{ padding: '10px 14px', fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {aliasSaved ? <Check size={16} /> : <UserCheck size={16} />}
              {aliasSaved ? 'Salvato!' : 'Salva'}
            </button>
          </div>
        </div>

        {/* Multi-Selezione Mansioni Operative (Cassa, Fattorino, Pizzeria) */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '20px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
            Ruoli Operativi in Pizzeria (Seleziona uno o più)
          </label>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '10px' }}>
            Determina in quali calendari settoriali del planning apparirà l'account
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
            {[
              { id: 'cassa', label: '💵 Cassa' },
              { id: 'fattorino', label: '🛵 Fattorino' },
              { id: 'pizzeria', label: '🍕 Pizzeria' }
            ].map(m => {
              const isSelected = editingMansioni.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleToggleMansione(m.id)}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                    background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                    color: isSelected ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {m.label} {isSelected ? '✓' : ''}
                </button>
              );
            })}
          </div>

          {editingMansioni.length === 0 && (
            <span style={{ display: 'block', fontSize: '0.75rem', color: '#fbbf24', marginBottom: '10px', fontStyle: 'italic', textAlign: 'center' }}>
              ⚠️ Nessun settore selezionato. L'account non apparirà nei planning settoriali.
            </span>
          )}

          <button
            type="button"
            onClick={handleSaveMansioni}
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '10px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {mansioniSaved ? <Check size={16} /> : <UserCheck size={16} />}
            {mansioniSaved ? 'Mansioni Salvate!' : 'Salva Ruoli Operativi'}
          </button>
        </div>

        {/* Current Role Card */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block' }}>Ruolo Attuale</span>
              <strong style={{ fontSize: '1.1rem', color: '#f8fafc', textTransform: 'capitalize' }}>
                {activeEmp?.nome || 'Utente'} ({targetIsAdmin ? 'Amministratore / Titolare' : 'Dipendente'})
              </strong>
            </div>
            <span style={{
              fontSize: '0.75rem',
              padding: '4px 10px',
              borderRadius: '20px',
              background: targetIsAdmin ? 'rgba(56, 189, 248, 0.2)' : 'rgba(129, 140, 248, 0.2)',
              color: targetIsAdmin ? '#38bdf8' : '#a5b4fc',
              fontWeight: 700,
              textTransform: 'uppercase'
            }}>
              {activeEmp?.ruolo || 'dipendente'}
            </span>
          </div>
        </div>

        {/* Role Switcher Action (Solo gli Admin possono cambiare ruolo) */}
        {currentUserIsAdmin ? (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
              Cambia Ruolo Account
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '12px' }}>
              {isSelf
                ? 'Passando a Dipendente potrai gestire solo i tuoi turni personali.'
                : `Modifica l'accesso per ${activeEmp?.nome || 'questo account'} (Amministratore vs Dipendente).`}
            </p>
            <button
              onClick={handleToggleRole}
              disabled={loading}
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              <ArrowRightLeft size={18} color="#38bdf8" />
              {targetIsAdmin ? 'Passa a Dipendente' : 'Promuovi ad Admin / Titolare'}
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: '24px', background: 'rgba(15, 23, 42, 0.4)', padding: '12px 14px', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
              ℹ️ Il ruolo di <strong>Amministratore / Titolare</strong> può essere assegnato solo dal titolare del locale.
            </p>
          </div>
        )}

        {/* Account Deletion Section */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn-danger"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Trash2 size={18} />
              {isSelf ? 'Elimina il mio Account' : `Elimina Account (${activeEmp?.nome})`}
            </button>
          ) : (
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', marginBottom: '8px' }}>
                <AlertTriangle size={20} />
                <strong style={{ fontSize: '0.9rem' }}>Confermi l'eliminazione?</strong>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '14px' }}>
                Tutti i dati ed i turni registrati per {activeEmp?.nome || 'questo utente'} verranno cancellati definitivamente.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Annulla
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={loading}
                  className="btn-danger"
                  style={{ flex: 1, justifyContent: 'center', background: '#ef4444', color: '#ffffff' }}
                >
                  Sì, Elimina
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Close Button at bottom for easy mobile dismissal */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '0.9rem', fontWeight: 600 }}
          >
            Chiudi Finestra
          </button>
        </div>

      </div>
    </div>
  );
}
