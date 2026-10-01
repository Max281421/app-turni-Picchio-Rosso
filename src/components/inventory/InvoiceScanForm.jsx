import React, { useState, useRef } from 'react';
import { analyzeInvoiceImage } from '../../lib/geminiVision';
import { Camera, Upload, Sparkles, Check, Plus, Trash2, ArrowLeft, RefreshCw, Calculator, Link as LinkIcon } from 'lucide-react';

/**
 * Algoritmo di Fuzzy Matching per abbinare automaticamente i nomi grezzi dei prodotti in fattura
 * con gli ingredienti già presenti nel magazzino dell'utente.
 */
function findBestMatchingInventoryItem(rawName, existingItems) {
  if (!rawName || !existingItems || existingItems.length === 0) return null;

  const clean = (str) =>
    (str || '')
      .toLowerCase()
      .replace(/\b(dop|igp|sacchi|fresco|freschi|busta|cartone|d'agerola|napoletani|pugliese|rossi|datterini|san marzano)\b/gi, '')
      .replace(/[^a-z0-9\/\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const targetClean = clean(rawName);
  const targetWords = targetClean.split(' ').filter((w) => w.length >= 1);

  let bestMatch = null;
  let bestScore = 0;

  for (const item of existingItems) {
    const itemClean = clean(item.name);
    const itemWords = itemClean.split(' ').filter((w) => w.length > 2);

    // Corrispondenza pulita esatta
    if (targetClean === itemClean && targetClean.length > 0) {
      return item;
    }

    // Punteggio intersezione parole
    let matchedWords = 0;
    for (const tw of targetWords) {
      if (itemWords.some((iw) => iw.includes(tw) || tw.includes(iw))) {
        matchedWords++;
      }
    }

    const score = matchedWords / Math.max(targetWords.length, 1);
    if (score > 0.35 && score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestMatch;
}

export default function InvoiceScanForm({
  suppliers,
  inventoryItems = [],
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
  const [totalAmount, setTotalAmount] = useState('');
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

      // Abbinamento intelligente ingredienti estratti con giacenze magazzino esistenti
      const itemsWithMapping = (data.items || []).map((it) => {
        const match = findBestMatchingInventoryItem(it.item_name, inventoryItems);
        return {
          ...it,
          target_item_id: match ? match.id : 'new',
          target_item_name: match ? match.name : it.item_name,
        };
      });

      setItems(itemsWithMapping);

      const itemsSum = (data.items || []).reduce((acc, curr) => acc + (Number(curr.total_price) || 0), 0);
      const parsedTotal = Number(data.total_amount) || 0;
      setTotalAmount(parsedTotal > 0 ? parsedTotal.toString() : itemsSum > 0 ? itemsSum.toFixed(2) : '');
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

    // Se cambia il nome del prodotto e non è abbinato, aggiorna anche il target name
    if (field === 'item_name' && updated[index].target_item_id === 'new') {
      updated[index].target_item_name = value;
    }

    setItems(updated);
  };

  const handleTargetItemChange = (index, targetId) => {
    const updated = [...items];
    if (targetId === 'new') {
      updated[index].target_item_id = 'new';
      updated[index].target_item_name = updated[index].item_name;
    } else {
      const found = inventoryItems.find((inv) => inv.id === targetId);
      if (found) {
        updated[index].target_item_id = found.id;
        updated[index].target_item_name = found.name;
        // Allinea l'unità di misura a quella esistente in magazzino
        if (found.unit_of_measure) {
          updated[index].unit_of_measure = found.unit_of_measure;
        }
      }
    }
    setItems(updated);
  };

  const handleAddItemRow = () => {
    setItems([
      ...items,
      {
        item_name: 'Nuovo Ingrediente',
        target_item_id: 'new',
        target_item_name: 'Nuovo Ingrediente',
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

  const calculateItemsSum = () => {
    return items.reduce((acc, curr) => acc + (Number(curr.total_price) || 0), 0);
  };

  const syncTotalWithItemsSum = () => {
    setTotalAmount(calculateItemsSum().toFixed(2));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!supplierName.trim() || !invoiceNumber.trim()) {
      alert('Compila il nome del fornitore ed il numero di fattura.');
      return;
    }

    const itemsSum = calculateItemsSum();
    const finalTotal = parseFloat(totalAmount) || itemsSum;

    const payload = {
      supplier_name: supplierName,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      payment_status: paymentStatus,
      total_amount: Number(finalTotal.toFixed(2)),
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
              Scatta una foto della fattura per estrarre ed aggiornare automaticamente giacenze e prezzi al kg degli ingredienti.
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
                Analisi Intelligenza Artificiale in Corso...
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Lettura fornitore, prodotti, quantità, prezzi e abbinamento automatico con gli ingredienti in magazzino
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
                  <strong>Fattura Analizzata!</strong> Gli ingredienti sono stati estratti ed abbinati automaticamente al tuo magazzino. Puoi verificare o cambiare gli abbinamenti prima di confermare.
                </span>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 1. Dati Generali della Fattura */}
                <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '8px' }}>
                    1. Intestazione Fattura & Totale Documento
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
                      <label className="input-label">Totale Fattura (€ incl. IVA) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(e.target.value)}
                        className="input-field"
                        style={{ width: '100%', fontWeight: 800, color: '#34d399', fontSize: '1.05rem' }}
                        placeholder="es. 414.92"
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

                {/* 2. Elenco Ingredienti Estratti & Abbinamento Giacenze */}
                <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                      2. Ingredienti Estratti & Abbinamento Giacenze Magazzino
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

                  {items.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                      Nessuna voce estratta. Clicca su "+ Aggiungi Voce" per inserire gli ingredienti.
                    </div>
                  ) : (
                    items.map((item, idx) => {
                      const isMapped = item.target_item_id && item.target_item_id !== 'new';
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '16px',
                            borderRadius: '14px',
                            background: 'rgba(15, 23, 42, 0.75)',
                            border: isMapped
                              ? '1px solid rgba(52, 211, 153, 0.4)'
                              : '1px solid rgba(255, 255, 255, 0.12)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                          }}
                        >
                          {/* Prima Riga: Nome in Fattura vs Abbinamento Ingrediente Magazzino */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'center' }}>
                            <div>
                              <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                                Nome Prodotto in Fattura
                              </label>
                              <input
                                type="text"
                                value={item.item_name}
                                onChange={(e) => handleUpdateItem(idx, 'item_name', e.target.value)}
                                className="input-field"
                                style={{ width: '100%', fontWeight: 700, color: '#f8fafc' }}
                                placeholder="Nome del prodotto in fattura"
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '0.72rem', color: isMapped ? '#34d399' : '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                <LinkIcon size={12} />
                                {isMapped ? 'Abbinato a Ingrediente Esistente:' : 'Aggiorna Giacenza Magazzino:'}
                              </label>
                              <select
                                value={item.target_item_id || 'new'}
                                onChange={(e) => handleTargetItemChange(idx, e.target.value)}
                                className="input-field"
                                style={{
                                  width: '100%',
                                  fontWeight: 600,
                                  color: isMapped ? '#34d399' : '#38bdf8',
                                  borderColor: isMapped ? 'rgba(52, 211, 153, 0.6)' : 'rgba(56, 189, 248, 0.4)',
                                  background: isMapped ? 'rgba(16, 185, 129, 0.1)' : 'rgba(15, 23, 42, 0.8)',
                                }}
                              >
                                <option value="new">+ Crea come Nuovo Ingrediente ("{item.item_name}")</option>
                                {inventoryItems.map((inv) => (
                                  <option key={inv.id} value={inv.id}>
                                    📦 {inv.name} (Attuale: {inv.current_stock} {inv.unit_of_measure})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.2)',
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  color: '#f87171',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Trash2 size={14} />
                                Rimuovi
                              </button>
                            </div>
                          </div>

                          {/* Seconda Riga: Dettagli Quantità, Unità, Pezzi per Cartone e Prezzi */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', alignItems: 'center' }}>
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
                                <option value="cartoni">cartoni (CT/CF)</option>
                                <option value="kg">kg</option>
                                <option value="litri">litri</option>
                                <option value="buste">buste</option>
                                <option value="pezzi">pezzi</option>
                              </select>
                            </div>

                            {['cartoni', 'ct', 'cf', 'casse', 'confezioni'].includes((item.unit_of_measure || '').toLowerCase()) && (
                              <div>
                                <label style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>Pz / Cartone (qxc)</label>
                                <input
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={item.pieces_per_package || 24}
                                  onChange={(e) => handleUpdateItem(idx, 'pieces_per_package', parseInt(e.target.value) || 1)}
                                  className="input-field"
                                  style={{ width: '100%', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8', fontWeight: 700 }}
                                />
                              </div>
                            )}

                            <div>
                              <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Totale Voce (€)</label>
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
                                Prezzo al Cartone
                              </span>
                              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
                                € {Number(item.unit_price || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Badge Calcolo Bottiglie / Pezzi Totali se Unità è Cartoni */}
                          {['cartoni', 'ct', 'cf', 'casse', 'confezioni'].includes((item.unit_of_measure || '').toLowerCase()) && (
                            <div
                              style={{
                                fontSize: '0.78rem',
                                color: '#34d399',
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '6px',
                              }}
                            >
                              <span>
                                🍾 Conteggio Bottiglie/Pezzi: <strong>{(Number(item.quantity || 0) * Number(item.pieces_per_package || 24)).toFixed(0)} pz totali</strong> ({item.quantity} cartoni × {item.pieces_per_package || 24} pz)
                              </span>
                              <span>
                                Costo singolo pezzo: <strong>€ {((Number(item.unit_price) || 0) / (Number(item.pieces_per_package) || 24)).toFixed(2)} / pz</strong>
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* Riepilogo Totali */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '14px',
                      borderRadius: '12px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem', color: '#94a3b8' }}>
                      <span>Somma Imponibile Voci:</span>
                      <span>€ {calculateItemsSum().toFixed(2)}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, color: '#f8fafc' }}>
                      <span>Totale Documento (incl. IVA):</span>
                      <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#34d399' }}>
                        € {Number(parseFloat(totalAmount) || calculateItemsSum()).toFixed(2)}
                      </span>
                    </div>

                    {Math.abs((parseFloat(totalAmount) || 0) - calculateItemsSum()) > 0.01 && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <button
                          type="button"
                          onClick={syncTotalWithItemsSum}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', gap: '4px' }}
                        >
                          <Calculator size={12} />
                          Imposta Totale = Somma Voci (€ {calculateItemsSum().toFixed(2)})
                        </button>
                      </div>
                    )}
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
