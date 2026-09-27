import React, { useState } from 'react';
import { Truck, Plus, Phone, Mail, FileText, Trash2, X } from 'lucide-react';

export default function SupplierModal({
  suppliers,
  onAddSupplier,
  onDeleteSupplier,
  onClose,
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddSupplier({
      name,
      phone,
      email,
      notes,
    });

    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ maxWidth: '500px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Truck size={22} style={{ color: '#38bdf8' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Anagrafica Fornitori</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Nuovo Fornitore */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          <input
            type="text"
            required
            placeholder="Nome Ditta / Fornitore *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input
              type="text"
              placeholder="Telefono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
            />
          </div>

          <button type="submit" className="btn-primary" style={{ padding: '8px', fontSize: '0.85rem' }}>
            <Plus size={16} /> Aggiungi Fornitore
          </button>
        </form>

        {/* Lista Fornitori Esistenti */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#94a3b8' }}>Fornitori Registrati ({suppliers.length}):</div>
          {suppliers.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Nessun fornitore salvato.</div>
          ) : (
            suppliers.map((sup) => (
              <div
                key={sup.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>{sup.name}</div>
                  {(sup.phone || sup.email) && (
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                      {sup.phone} {sup.phone && sup.email ? '•' : ''} {sup.email}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onDeleteSupplier(sup.id)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
