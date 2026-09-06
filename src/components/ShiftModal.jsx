import React, { useState, useEffect } from 'react';
import { Sun, Moon, X, Check, Trash2 } from 'lucide-react';

export default function ShiftModal({ isOpen, date, existingShifts, onSave, onDelete, onClose, employeeName }) {
  const [hasPranzo, setHasPranzo] = useState(false);
  const [hasCena, setHasCena] = useState(false);

  useEffect(() => {
    if (existingShifts) {
      setHasPranzo(existingShifts.some((s) => s.turno === 'pranzo'));
      setHasCena(existingShifts.some((s) => s.turno === 'cena'));
    } else {
      setHasPranzo(false);
      setHasCena(false);
    }
  }, [existingShifts, date]);

  if (!isOpen || !date) return null;

  const dateObj = new Date(date);
  const formattedDate = dateObj.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const handleSave = () => {
    onSave(date, { pranzo: hasPranzo, cena: hasCena });
    onClose();
  };

  const handleDeleteAll = () => {
    onDelete(date);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-card modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', textTransform: 'capitalize' }}>
              {formattedDate}
            </h3>
            {employeeName && (
              <p style={{ fontSize: '0.85rem', color: '#38bdf8', marginTop: '2px' }}>
                Dipendente: <strong>{employeeName}</strong>
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '20px' }}>
          Seleziona i turni svolti in questa giornata:
        </p>

        {/* Toggle Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <button
            type="button"
            onClick={() => setHasPranzo(!hasPranzo)}
            style={{
              padding: '16px 12px',
              borderRadius: '12px',
              border: hasPranzo ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
              background: hasPranzo ? 'rgba(245, 158, 11, 0.2)' : 'rgba(15, 23, 42, 0.6)',
              color: hasPranzo ? '#fbbf24' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            <Sun size={28} color={hasPranzo ? '#fbbf24' : '#64748b'} />
            <span>Turno Pranzo</span>
            {hasPranzo && <Check size={16} color="#fbbf24" />}
          </button>

          <button
            type="button"
            onClick={() => setHasCena(!hasCena)}
            style={{
              padding: '16px 12px',
              borderRadius: '12px',
              border: hasCena ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
              background: hasCena ? 'rgba(99, 102, 241, 0.2)' : 'rgba(15, 23, 42, 0.6)',
              color: hasCena ? '#a5b4fc' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            <Moon size={28} color={hasCena ? '#a5b4fc' : '#64748b'} />
            <span>Turno Cena</span>
            {hasCena && <Check size={16} color="#a5b4fc" />}
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
          {existingShifts && existingShifts.length > 0 && (
            <button onClick={handleDeleteAll} className="btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Trash2 size={16} />
              Elimina
            </button>
          )}

          <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto' }}>
            <button onClick={onClose} className="btn-secondary">
              Annulla
            </button>
            <button onClick={handleSave} className="btn-primary">
              Salva Turni
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
