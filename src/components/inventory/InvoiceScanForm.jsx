import React, { useState, useRef, useEffect } from 'react';
import { analyzeInvoiceImage } from '../../lib/geminiVision';
import { Camera, Upload, Sparkles, Check, AlertCircle, Plus, Trash2, ArrowLeft, RefreshCw, Layers, Key, X } from 'lucide-react';

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
  const [isSimulated, setIsSimulated] = useState(false);

  // Gemini API Key State
  const [apiKey, setApiKey] = useState(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('gemini_api_key')) || import.meta.env?.VITE_GEMINI_API_KEY || '';
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

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

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    const cleanKey = tempApiKey.trim();
    if (typeof window !== 'undefined') {
      if (cleanKey) {
        localStorage.setItem('gemini_api_key', cleanKey);
      } else {
        localStorage.removeItem('gemini_api_key');
      }
    }
    setApiKey(cleanKey);
    setShowApiKeyModal(false);
  };

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
    await runVisionScan(file);
  };

  const [scanError, setScanError] = useState(null);

  const runVisionScan = async (file) => {
    setScanning(true);
    setScanError(null);
    try {
      const data = await analyzeInvoiceImage(file, apiKey || null);
      setExtractedData(data);
      setIsSimulated(data.is_simulated || false);

      // Precompila il Form
      setSupplierName(data.supplier_name || '');
      setInvoiceNumber(data.invoice_number || '');
      setInvoiceDate(data.invoice_date || new Date().toISOString().split('T')[0]);
      setDueDate(data.due_date || '');
      setPaymentStatus(data.payment_status || 'da_pagare');
      setItems(data.items || []);
    } catch (err) {
      console.error('Errore durante la scansione dell\'immagine:', err);
      setScanError(err.message || 'Errore durante la scansione dell\'immagine.');
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              setTempApiKey(apiKey);
              setShowApiKeyModal(true);
            }}
            className="btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: apiKey ? 'rgba(16, 185, 129, 0.4)' : 'rgba(234, 179, 8, 0.4)',
              color: apiKey ? '#34d399' : '#facc15',
            }}
          >
            <Key size={14} />
            <span>{apiKey ? '🔑 API Key Gemini Attiva' : '⚠️ Modalità Demo (Inserisci Key)'}</span>
          </button>
        </div>
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
              borderRadius: '20px',
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
            }}
          >
            <Sparkles size={32} />
          </div>

          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
              Carica o Scatta Foto alla Fattura
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '400px', margin: '0 auto' }}>
              L'Intelligenza Artificiale leggerà in automatico i prodotti, le quantità, i prezzi al kg e il totale della fattura.
            </p>
          </div>

          {/* Input per Fotocamera Smartphone & File Manager */}
          <input
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            ref={cameraInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <input
            type="file"
            accept="image/*,application/pdf"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '10px' }}>
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
        /* Schermata di Analisi e Form Precompilato dall'IA */
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
                Lettura Fattura con AI Vision in Corso...
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Estrazione automatica fornitori, prodotti e prezzi al kg
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
            </div>
          ) : (
            <>
              {/* Avviso Errore Scansione Gemini */}
              {scanError && (
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    fontSize: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <AlertCircle size={18} />
                    <span>Errore Chiamata Google Gemini AI:</span>
                  </div>
                  <div style={{ fontWeight: 600 }}>{scanError}</div>
                  <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '4px' }}>
                    💡 Le API Key di Google AI Studio iniziano con <strong>AIzaSy...</strong>. Clicca sul pulsante in alto per verificare la chiave generata su <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>aistudio.google.com</a>.
                  </div>
                </div>
              )}

              {/* Informazione Modalità Lettura */}
              {isSimulated && !scanError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    fontSize: '0.8rem',
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Sparkles size={16} />
                  <span>
                    <strong>Dati Estratti dall'IA (Modalità Demo):</strong> Verifica i dati e apporta eventuali modifiche prima di salvare in magazzino.
                  </span>
                </div>
              )}

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
                        placeholder="es. Latticini Rossi Srl"
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
                        placeholder="es. FT-2026/142"
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
                        <option value="scaduto">Scaduto</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Dettaglio Ingredienti ed Auto-Carico */}
                <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                      2. Ingredienti Estratti & Carico Magazzino
                    </h3>

                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      <Plus size={16} />
                      + Aggiungi Voce
                    </button>
                  </div>

                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                          type="text"
                          required
                          value={item.item_name}
                          onChange={(e) => handleUpdateItem(idx, 'item_name', e.target.value)}
                          className="input-field"
                          style={{ flex: 1, fontWeight: 700 }}
                          placeholder="Nome Ingrediente"
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px',
                            color: '#ef4444',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Quantità</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                            className="input-field"
                            style={{ width: '100%', fontSize: '0.85rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Unità</label>
                          <select
                            value={item.unit_of_measure}
                            onChange={(e) => handleUpdateItem(idx, 'unit_of_measure', e.target.value)}
                            className="input-field"
                            style={{ width: '100%', fontSize: '0.85rem' }}
                          >
                            <option value="kg">kg</option>
                            <option value="litri">litri</option>
                            <option value="buste">buste</option>
                            <option value="cartoni">cartoni</option>
                            <option value="pezzi">pezzi</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Totale (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={item.total_price}
                            onChange={(e) => handleUpdateItem(idx, 'total_price', e.target.value)}
                            className="input-field"
                            style={{ width: '100%', fontSize: '0.85rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>€ / {item.unit_of_measure}</label>
                          <div
                            style={{
                              padding: '8px',
                              borderRadius: '8px',
                              background: 'rgba(56, 189, 248, 0.1)',
                              color: '#38bdf8',
                              fontWeight: 800,
                              fontSize: '0.85rem',
                              textAlign: 'center',
                            }}
                          >
                            € {Number(item.unit_price || 0).toFixed(2)}
                          </div>
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

      {/* Modale Inserimento / Gestione API Key Gemini */}
      {showApiKeyModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '440px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={20} style={{ color: '#38bdf8' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  Configura API Key Gemini
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '16px', lineHeight: 1.4 }}>
              Inserisci la tua <strong>API Key gratuita di Google Gemini</strong> per attivare il riconoscimento reale tramite IA Vision su qualsiasi foto di fattura o DDT.
            </p>

            <form onSubmit={handleSaveApiKey} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="input-label">Gemini API Key (Google AI Studio)</label>
                <input
                  type="text"
                  placeholder="AIzaSy..."
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
              </div>

              {tempApiKey.trim() !== '' && !tempApiKey.trim().startsWith('AIzaSy') && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    fontSize: '0.78rem',
                    color: '#f87171',
                    lineHeight: 1.4,
                  }}
                >
                  ⚠️ <strong>Attenzione sul formato della chiave:</strong> Le API Key di Google AI Studio iniziano con <strong>AIzaSy...</strong>. Il testo incollato sembra un token OAuth o una chiave di un altro servizio. Assicurati di aver generato la chiave su <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>aistudio.google.com/app/apikey</a>.
                </div>
              )}

              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                💡 Puoi ottenerne una in 1 minuto gratis su <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>aistudio.google.com</a>. Verrà salvata solo nel tuo browser.
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1 }}
                >
                  Salva Chiave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
