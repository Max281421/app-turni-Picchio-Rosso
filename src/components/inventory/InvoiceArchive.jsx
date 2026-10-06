import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp, Edit3, Trash2, X, Check, Eye, Download, FileText, Image as ImageIcon, Upload, Paperclip } from 'lucide-react';
import { compressImageFile } from '../../lib/geminiVision';

export default function InvoiceArchive({
  invoices,
  onTogglePaymentStatus,
  onEditInvoice,
  onDeleteInvoice,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('tutti');
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState([]);
  const [editingInvoice, setEditingInvoice] = useState(null);

  // State Anteprima Foto/Documento (Lightbox Modal)
  const [previewModal, setPreviewModal] = useState({ open: false, fileUrl: null, supplier: '', number: '', date: '' });

  // State Modifica Fattura
  const [editSupplier, setEditSupplier] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editStatus, setEditStatus] = useState('da_pagare');
  const [editTotal, setEditTotal] = useState('0');
  const [editNotes, setEditNotes] = useState('');
  const [editFileUrl, setEditFileUrl] = useState(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const toggleExpand = (invoiceId) => {
    setExpandedInvoiceIds((prev) =>
      prev.includes(invoiceId)
        ? prev.filter((id) => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

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

  const handleOpenEdit = (inv, e) => {
    e.stopPropagation();
    setEditingInvoice(inv);
    setEditSupplier(inv.supplier_name || '');
    setEditNumber(inv.invoice_number || '');
    setEditDate(inv.invoice_date || '');
    setEditDueDate(inv.due_date || '');
    setEditStatus(inv.payment_status || 'da_pagare');
    setEditTotal(inv.total_amount?.toString() || '0');
    setEditNotes(inv.notes || '');
    setEditFileUrl(inv.file_url || null);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingInvoice || !editSupplier.trim() || !editNumber.trim()) return;

    const updated = {
      ...editingInvoice,
      supplier_name: editSupplier.trim(),
      invoice_number: editNumber.trim(),
      invoice_date: editDate,
      due_date: editDueDate || null,
      payment_status: editStatus,
      total_amount: parseFloat(editTotal) || 0,
      notes: editNotes,
      file_url: editFileUrl || null,
    };

    onEditInvoice(updated);
    setEditingInvoice(null);
  };

  const handleEditFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    try {
      const compressedDataUrl = await compressImageFile(file);
      setEditFileUrl(compressedDataUrl);
    } catch (err) {
      console.error('Errore caricamento file:', err);
      alert('Impossibile caricare il file selezionato');
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleDelete = (inv) => {
    if (window.confirm(`Sei sicuro di voler eliminare la fattura N° ${inv.invoice_number} del fornitore "${inv.supplier_name}"?`)) {
      onDeleteInvoice(inv.id);
      setEditingInvoice(null);
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
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '14px',
              color: '#94a3b8',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Cerca per fornitore o n° fattura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '42px', width: '100%' }}
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

      {/* Lista Fatture (con Tendina Espandibile al Tocco) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredInvoices.length === 0 ? (
          <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            Nessuna fattura trovata nell'archivio.
          </div>
        ) : (
          filteredInvoices.map((inv) => {
            const badge = getStatusBadge(inv.payment_status);
            const isExpanded = expandedInvoiceIds.includes(inv.id);
            const itemCount = inv.items?.length || 0;

            return (
              <div
                key={inv.id}
                className="glass-card"
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: isExpanded ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                }}
                onClick={() => toggleExpand(inv.id)}
              >
                {/* Header della Card Fattura */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc' }}>
                        {inv.supplier_name}
                      </span>
                      {isExpanded ? <ChevronUp size={18} color="#38bdf8" /> : <ChevronDown size={18} color="#94a3b8" />}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                      N° Fattura: <strong style={{ color: '#cbd5e1' }}>{inv.invoice_number}</strong> • Data: {inv.invoice_date}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>
                        {isExpanded ? '▲ Nascondi ingredienti' : `▼ Vedere i ${itemCount} ingredienti`}
                      </div>

                      {inv.file_url ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewModal({
                              open: true,
                              fileUrl: inv.file_url,
                              supplier: inv.supplier_name,
                              number: inv.invoice_number,
                              date: inv.invoice_date,
                            });
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 9px',
                            borderRadius: '8px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            color: '#38bdf8',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          title="Visualizza o scarica la foto/documento della fattura"
                        >
                          <Eye size={13} /> Foto / Allegato
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic' }}>
                          (Nessuna foto allegata)
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#38bdf8' }}>
                      € {Number(inv.total_amount).toFixed(2)}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePaymentStatus(inv.id);
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="Clicca per cambiare stato pagamento"
                      >
                        {badge.label} ↻
                      </button>

                      <button
                        onClick={(e) => handleOpenEdit(inv, e)}
                        title="Modifica / Elimina Fattura"
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '8px',
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#f8fafc',
                          cursor: 'pointer',
                        }}
                      >
                        <Edit3 size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Voci della Fattura INCOLONNATE IN VERTICALE */}
                {isExpanded && inv.items && inv.items.length > 0 && (
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(56, 189, 248, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      marginTop: '4px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.8rem', marginBottom: '2px' }}>
                      Ingredienti Consegnati in Fattura ({inv.items.length}):
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {inv.items.map((it, idx) => {
                        const disc = Number(it.discount_percent) || 0;
                        const grossUPrice = Number(it.unit_price) || 0;
                        const netUPrice = disc > 0 ? grossUPrice * (1 - disc / 100) : grossUPrice;

                        return (
                          <div
                            key={idx}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '8px',
                              background: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{it.item_name}</span>
                                {disc > 0 && (
                                  <span style={{ fontSize: '0.7rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 700 }}>
                                    🏷️ -{disc}% Sconto
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {disc > 0 ? (
                                  <>
                                    Listino: € {grossUPrice.toFixed(2)} → <strong style={{ color: '#38bdf8' }}>Netto: € {netUPrice.toFixed(2)} /{it.unit_of_measure}</strong>
                                  </>
                                ) : (
                                  <>
                                    Prezzo unitario: <strong style={{ color: '#38bdf8' }}>€ {netUPrice.toFixed(2)} /{it.unit_of_measure}</strong>
                                  </>
                                )}
                                {['cartoni', 'ct', 'cf', 'casse', 'confezioni'].includes((it.unit_of_measure || '').toLowerCase()) && (
                                  <span style={{ color: '#34d399', marginLeft: '6px' }}>
                                    ({it.pieces_per_package || 24} pz/ct → <strong>{(Number(it.quantity || 0) * Number(it.pieces_per_package || 24)).toFixed(0)} bottiglie totali</strong>)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#34d399' }}>
                                {it.quantity} {it.unit_of_measure}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                                Totale netto: € {Number(it.total_price || 0).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modale Modifica / Eliminazione Fattura */}
      {editingInvoice && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '440px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                Modifica Dati Fattura
              </h3>
              <button
                onClick={() => setEditingInvoice(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="input-label">Fornitore *</label>
                <input
                  type="text"
                  required
                  value={editSupplier}
                  onChange={(e) => setEditSupplier(e.target.value)}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">N° Fattura / DDT *</label>
                  <input
                    type="text"
                    required
                    value={editNumber}
                    onChange={(e) => setEditNumber(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label className="input-label">Importo Totale (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editTotal}
                    onChange={(e) => setEditTotal(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">Data Fattura</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label className="input-label">Data Scadenza</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Stato Pagamento</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="input-field"
                  style={{ width: '100%' }}
                >
                  <option value="da_pagare">Da Pagare</option>
                  <option value="pagato">Pagato</option>
                  <option value="scaduto">Scaduto</option>
                </select>
              </div>

              <div>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Paperclip size={14} color="#38bdf8" /> Allegato / Foto Scansione Fattura
                </label>

                {editFileUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255, 255, 255, 0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    {editFileUrl.startsWith('data:image/') || !editFileUrl.includes('.pdf') ? (
                      <img src={editFileUrl} alt="Anteprima" style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '6px' }} />
                    ) : (
                      <FileText size={32} color="#38bdf8" />
                    )}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Foto/Documento allegato presente
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#34d399' }}>Pronto per la conservazione</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditFileUrl(null)}
                      style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Rimuovi
                    </button>
                  </div>
                ) : (
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '2px dashed rgba(56, 189, 248, 0.4)',
                    background: 'rgba(56, 189, 248, 0.05)',
                    color: '#38bdf8',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                    <Upload size={16} />
                    {isUploadingFile ? 'Elaborazione file...' : 'Carica o scatta foto della fattura'}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      capture="environment"
                      onChange={handleEditFileChange}
                      style={{ display: 'none' }}
                      disabled={isUploadingFile}
                    />
                  </label>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => handleDelete(editingInvoice)}
                  className="btn-danger"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Trash2 size={16} /> Eliminazione
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  disabled={isUploadingFile}
                >
                  <Check size={16} /> Salva Fattura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Lightbox Visualizzazione Foto/Documento Fattura */}
      {previewModal.open && (
        <div
          className="modal-overlay"
          style={{ zIndex: 1100, backgroundColor: 'rgba(0,0,0,0.88)' }}
          onClick={() => setPreviewModal({ open: false, fileUrl: null, supplier: '', number: '', date: '' })}
        >
          <div
            className="modal-content glass-card"
            style={{
              maxWidth: '800px',
              width: '92%',
              maxHeight: '90vh',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ImageIcon size={20} color="#38bdf8" /> Fattura: {previewModal.supplier}
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  N° {previewModal.number} • Data: {previewModal.date}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {previewModal.fileUrl && (
                  <a
                    href={previewModal.fileUrl}
                    download={`Fattura_${previewModal.supplier}_${previewModal.number || 'doc'}.jpg`}
                    className="btn-primary"
                    style={{
                      padding: '6px 14px',
                      fontSize: '0.8rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      textDecoration: 'none',
                    }}
                  >
                    <Download size={15} /> Scarica File
                  </a>
                )}
                <button
                  onClick={() => setPreviewModal({ open: false, fileUrl: null, supplier: '', number: '', date: '' })}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '250px', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '10px' }}>
              {previewModal.fileUrl ? (
                previewModal.fileUrl.startsWith('data:application/pdf') || previewModal.fileUrl.endsWith('.pdf') ? (
                  <iframe
                    src={previewModal.fileUrl}
                    title="PDF Fattura"
                    style={{ width: '100%', height: '65vh', border: 'none', borderRadius: '8px' }}
                  />
                ) : (
                  <img
                    src={previewModal.fileUrl}
                    alt={`Foto Fattura ${previewModal.supplier}`}
                    style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                  />
                )
              ) : (
                <span style={{ color: '#94a3b8' }}>Nessuna immagine disponibile</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
