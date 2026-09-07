import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, User, X, Trash2, ArrowRightLeft, Check, AlertTriangle, UserCheck } from 'lucide-react';

export default function ProfileModal({ isOpen, onClose }) {
  const { user, employee, updateEmployeeRole, updateEmployeeName, updateEmployeeAlias, deleteAccount } = useAuth();
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingName, setEditingName] = useState(employee?.nome || '');
  const [editingAlias, setEditingAlias] = useState(employee?.alias || '');
  const [nameSaved, setNameSaved] = useState(false);
  const [aliasSaved, setAliasSaved] = useState(false);

  useEffect(() => {
    if (employee) {
      if (employee.nome) setEditingName(employee.nome);
      setEditingAlias(employee.alias || '');
    }
  }, [employee?.nome, employee?.alias]);

  if (!isOpen || !user) return null;

  const isAdmin = employee?.ruolo === 'admin';

  const handleSaveName = async () => {
    if (!employee?.id || !editingName.trim()) return;
    setLoading(true);
    try {
      await updateEmployeeName(employee.id, editingName.trim());
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Errore durante l\'aggiornamento del nome.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAlias = async () => {
    if (!employee?.id) return;
    setLoading(true);
    try {
      await updateEmployeeAlias(employee.id, editingAlias.trim());
      setAliasSaved(true);
      setTimeout(() => setAliasSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Errore durante l\'aggiornamento dell\'alias.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async () => {
    if (!employee?.id) return;
    setLoading(true);
    const newRole = isAdmin ? 'dipendente' : 'admin';
    try {
      await updateEmployeeRole(employee.id, newRole);
      alert(`Ruolo aggiornato con successo a: ${newRole.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      alert('Errore durante il cambio ruolo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelf = async () => {
    if (!employee?.id) return;
    setLoading(true);
    try {
      await deleteAccount(employee.id);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Errore durante l\'eliminazione dell\'account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="glass-card modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '28px', maxWidth: '460px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: isAdmin ? 'rgba(56, 189, 248, 0.15)' : 'rgba(129, 140, 248, 0.15)', padding: '10px', borderRadius: '12px' }}>
              {isAdmin ? <Shield size={24} color="#38bdf8" /> : <User size={24} color="#818cf8" />}
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                Gestione Profilo Utente
              </h3>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                {user.email}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
            <X size={24} />
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
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '20px' }}>
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

        {/* Current Role Card */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block' }}>Ruolo Attuale</span>
              <strong style={{ fontSize: '1.1rem', color: '#f8fafc', textTransform: 'capitalize' }}>
                {employee?.nome || 'Utente'} ({isAdmin ? 'Amministratore / Titolare' : 'Dipendente'})
              </strong>
            </div>
            <span style={{
              fontSize: '0.75rem',
              padding: '4px 10px',
              borderRadius: '20px',
              background: isAdmin ? 'rgba(56, 189, 248, 0.2)' : 'rgba(129, 140, 248, 0.2)',
              color: isAdmin ? '#38bdf8' : '#a5b4fc',
              fontWeight: 700,
              textTransform: 'uppercase'
            }}>
              {employee?.ruolo || 'dipendente'}
            </span>
          </div>
        </div>

        {/* Role Switcher Action (Solo gli Admin possono cambiare ruolo) */}
        {isAdmin ? (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
              Cambia Ruolo Account
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '12px' }}>
              Passando a Dipendente potrai gestire solo i tuoi turni personali.
            </p>
            <button
              onClick={handleToggleRole}
              disabled={loading}
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              <ArrowRightLeft size={18} color="#38bdf8" />
              Passa a Dipendente
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
              Elimina il mio Account
            </button>
          ) : (
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', marginBottom: '8px' }}>
                <AlertTriangle size={20} />
                <strong style={{ fontSize: '0.9rem' }}>Confermi l'eliminazione?</strong>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '14px' }}>
                Tutti i tuoi dati ed i turni registrati verranno cancellati definitivamente.
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
                  onClick={handleDeleteSelf}
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

      </div>
    </div>
  );
}
