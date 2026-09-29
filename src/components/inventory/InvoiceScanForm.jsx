import React, { useState, useRef } from 'react';
import { analyzeInvoiceImage } from '../../lib/geminiVision';
import { Camera, Upload, Sparkles, Check, Plus, Trash2, ArrowLeft, RefreshCw } from 'lucide-react';

export default function InvoiceScanForm({
  suppliers,
  inventoryItems,
  onSaveInvoice,
  onCancel,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [extractedData, setExtractedData] = useState(null);

  // Form State editabile
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('da_pagare');
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setFilePreviewUrl(null);
    }

    // Avvia la scansione automatica
    await runScan(file);
  };

  const runScan = async (file) => {
    setScanning(true);
    try {
      const data = await analyzeInvoiceImage(file);
      setExtractedData(data);

      // Precompila il Form
      setSupplierName(data.supplier_name || '');
      setInvoiceNumber(data.invoice_number || '');
      setInvoiceDate(data.invoice_date || new Date().toISOString().split('T')[0]);
      setDueDate(data.due_date || '');
      setPaymentStatus(data.payment_status || 'da_pagare');
      setItems(data.items || []);
    } catch (err) {
      console.error('Errore durante la lettura dell\'immagine:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleUpdateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-ricalcolo prezzo unitario se cambia totale o quantità
    if (field === 'quantity' || field === 'total_price') {
      const qty = parseFloat(field === 'quantity' ? value : updated[index].quantity) || 0;
      const tot = parseFloat(field === 'total_price' ? value : updated[index].total_price) || 0;
      if (qty > 0) {
        updated[index].unit_price = Number((tot / qty).toFixed(2));
      }
    }
    setItems(updated);
  };

  const handleAddItemRow = () => {
    setItems([
      ...items,
      {
        item_name: 'Nuovo Ingrediente',
        quantity: 1,
        unit_of_measure: 'kg',
        total_price: 0,
        unit_price: 0,
      },
    ]);
  };

  const handleRemoveItemRow = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotalInvoice = () => {
    return items.reduce((acc, curr) => acc + (Number(curr.total_price) || 0), 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!supplierName.trim() || !invoiceNumber.trim() || items.length === 0) {
      alert('Compila il nome del fornitore, il numero di fattura e inserisci almeno un ingrediente.');
      return;
    }

    const payload = {
      supplier_name: supplierName,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      payment_status: paymentStatus,
      total_amount: calculateTotalInvoice(),
      notes,
      items,
      file: selectedFile,
    };

    onSaveInvoice(payload);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Intestazione e Pulsante Indietro */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: '0.85rem' }}
        >
          <ArrowLeft size={16} />
          Torna alle Giacenze
        </button>
      </div>

      {/* Area Scatto Foto / Upload File se non ancora selezionato */}
      {!selectedFile ? (
        <div
          className="glass-card"
          style={{
            padding: '40px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            border: '2px dashed rgba(56, 189, 248, 0.4)',
            borderRadius: '20px',
            background: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
            }}
          >
            <Camera size={32} />
          </div>

          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
              Scansiona o Carica Foto Fattura / DDT
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', maxWidth: '420px', margin: '0 auto' }}>
              Scatta una foto nitida della fattura o seleziona un'immagine per estrarre ed aggiornare automaticamente i prezzi al kg ed il magazzino.
            </p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,.pdf"
            style={{ display: 'none' }}
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="btn-primary"
              style={{ padding: '12px 20px', fontSize: '0.9rem', gap: '8px' }}
            >
              <Camera size={20} />
              Scatta Foto con Fotocamera
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary"
              style={{ padding: '12px 20px', fontSize: '0.9rem', gap: '8px' }}
            >
              <Upload size={20} />
              Seleziona dalla Galleria / File
            </button>
          </div>
        </div>
      ) : (
        /* Schermata di Analisi e Form Precompilato */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Indicatore di Scansione in Corso */}
          {scanning ? (
            <div
              className="glass-card"
              style={{
                padding: '30px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <RefreshCw size={32} className="spin" style={{ color: '#38bdf8' }} />
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f8fafc' }}>
                Scansione ed Estrazione Testo in Corso...
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Analisi automatica fornitore, prodotti, quantità e prezzi al kg
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
            </div>
          ) : (
            <>
              {/* Banner Scansione Riuscita */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontSize: '0.85rem',
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <Sparkles size={18} />
                <span>
                  <strong>Fattura Analizzata!</strong> I dati ed i prodotti sono stati estratti nel modulo. Puoi verificare e modificare qualsiasi voce prima di confermare.
                </span>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 1. Dati Generali della Fattura */}
                <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '8px' }}>
                    1. Intestazione Fattura & Fornitore
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    <div>
                      <label className="input-label">Nome Fornitore *</label>
                      <input
                        type="text"
                        required
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        className="input-field"
                        style={{ width: '100%' }}
                        placeholder="es. Vesuvio Food Distribuzione"
                      />
                    </div>

                    <div>
                      <label className="input-label">Numero Fattura / DDT *</label>
                      <input
                        type="text"
                        required
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        className="input-field"
                        style={{ width: '100%' }}
                        placeholder="es. FT-2026/1044"
                      />
                    </div>

                    <div>
                      <label className="input-label">Data Fattura *</label>
                      <input
                        type="date"
                        required
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className="input-field"
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label className="input-label">Data Scadenza Pagamento</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="input-field"
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label className="input-label">Stato Pagamento</label>
                      <select
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value)}
                        className="input-field"
                        style={{ width: '100%' }}
                      >
                        <option value="da_pagare">Da Pagare</option>
                        <option value="pagato">Pagato</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Elenco Ingredienti Estratti */}
                <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                      2. Ingredienti Estratti & Carico Magazzino
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '4px' }}
                    >
                      <Plus size={14} />
                      + Aggiungi Voce
                    </button>
                  </div>

                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '14px',
                        borderRadius: '12px',
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="text"
                          value={item.item_name}
                          onChange={(e) => handleUpdateItem(idx, 'item_name', e.target.value)}
                          className="input-field"
                          style={{ flex: 1, fontWeight: 700, color: '#f8fafc' }}
                          placeholder="Nome del prodotto"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#f87171',
                            padding: '8px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', alignItems: 'center' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Quantità</label>
                          <input
                            type="number"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                            className="input-field"
                            style={{ width: '100%' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Unità</label>
                          <select
                            value={item.unit_of_measure}
                            onChange={(e) => handleUpdateItem(idx, 'unit_of_measure', e.target.value)}
                            className="input-field"
                            style={{ width: '100%' }}
                          >
                            <option value="kg">kg</option>
                            <option value="litri">litri</option>
                            <option value="buste">buste</option>
                            <option value="cartoni">cartoni</option>
                            <option value="pezzi">pezzi</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Totale (€)</label>
                          <input
                            type="number"
                            step="any"
                            value={item.total_price}
                            onChange={(e) => handleUpdateItem(idx, 'total_price', e.target.value)}
                            className="input-field"
                            style={{ width: '100%' }}
                          />
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.72rem', color: '#38bdf8', display: 'block' }}>
                            € / {item.unit_of_measure}
                          </span>
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
                            € {Number(item.unit_price || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Totale Generale Fattura */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px',
                      borderRadius: '12px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: '#f8fafc' }}>Totale Fattura Rilevato:</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#34d399' }}>
                      € {calculateTotalInvoice().toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Pulsanti di Azione Finale */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="btn-secondary"
                    style={{ flex: 1, padding: '12px' }}
                  >
                    Riscansiona Foto
                  </button>

                  <button
                    type="submit"
                    className="btn-primary"
                    style={{
                      flex: 2,
                      padding: '12px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      fontSize: '0.95rem',
                    }}
                  >
                    <Check size={20} />
                    Conferma & Carica in Magazzino
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
