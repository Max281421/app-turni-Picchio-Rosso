import React, { useState } from 'react';
import { Search, Calendar, FileText, CheckCircle2, Clock, AlertCircle, DollarSign, Filter } from 'lucide-react';

export default function InvoiceArchive({
  invoices,
  onTogglePaymentStatus,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('tutti');

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'tutti' || inv.payment_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calcolo metriche di spesa e scadenze
  const totalSpentMonth = invoices.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
  const totalToPay = invoices
    .filter((inv) => inv.payment_status === 'da_pagare' || inv.payment_status === 'scaduto')
    .reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pagato':
        return { label: 'Pagato', bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: 'rgba(16, 185, 129, 0.3)' };
      case 'scaduto':
        return { label: 'Scaduto', bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
      default:
        return { label: 'Da Pagare', bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Cards Metriche Riepilogative */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Spesa Totale Archiviata</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>
            € {totalSpentMonth.toFixed(2)}
          </span>
        </div>

        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: 600 }}>Totale Fatture Da Pagare</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171' }}>
            € {totalToPay.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Controlli di Ricerca e Filtri Stato */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
            }}
          />
          <input
            type="text"
            placeholder="Cerca per fornitore o n° fattura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '38px', width: '100%', borderRadius: '12px' }}
          />
        </div>

        {/* Filtri Pillola Stato Pagamento */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { id: 'tutti', label: 'Tutte le Fatture' },
            { id: 'da_pagare', label: 'Da Pagare' },
            { id: 'pagato', label: 'Pagate' },
            { id: 'scaduto', label: 'Scadute' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                background: statusFilter === f.id ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)',
                color: statusFilter === f.id ? '#0f172a' : '#94a3b8',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista Fatture */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredInvoices.length === 0 ? (
          <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            Nessuna fattura trovata nell'archivio.
          </div>
        ) : (
          filteredInvoices.map((inv) => {
            const badge = getStatusBadge(inv.payment_status);
            return (
              <div
                key={inv.id}
                className="glass-card"
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc' }}>
                      {inv.supplier_name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                      N° Fattura: <strong style={{ color: '#cbd5e1' }}>{inv.invoice_number}</strong> • Data: {inv.invoice_date}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#38bdf8' }}>
                      € {Number(inv.total_amount).toFixed(2)}
                    </div>

                    <button
                      onClick={() => onTogglePaymentStatus(inv.id)}
                      style={{
                        marginTop: '6px',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      title="Clicca per cambiare stato pagamento"
                    >
                      {badge.label} ↻
                    </button>
                  </div>
                </div>

                {/* Voci della Fattura */}
                {inv.items && inv.items.length > 0 && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      fontSize: '0.8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.75rem' }}>Prodotti Consegnati:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {inv.items.map((it, idx) => (
                        <span key={idx} style={{ color: '#cbd5e1' }}>
                          • {it.item_name}: <strong>{it.quantity} {it.unit_of_measure}</strong> (€ {Number(it.unit_price).toFixed(2)}/{it.unit_of_measure})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
