import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import InventoryList from './InventoryList';
import InvoiceScanForm from './InvoiceScanForm';
import InvoiceArchive from './InvoiceArchive';
import SupplierModal from './SupplierModal';
import PriceHistoryModal from './PriceHistoryModal';
import { Package, Sparkles, FileText, Truck, Plus } from 'lucide-react';

function loadLocalStorage(key, fallback = []) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
}

export default function InventoryDashboard() {
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'scan' | 'archive'
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [selectedPriceHistoryItem, setSelectedPriceHistoryItem] = useState(null);

  // State Dati con persistenza locale (localStorage) per evitare perdite dopo reload/deployment
  const [inventoryItems, setInventoryItems] = useState(() => loadLocalStorage('APP_TURNI_INVENTORY_ITEMS', []));
  const [invoices, setInvoices] = useState(() => loadLocalStorage('APP_TURNI_INVOICES', []));
  const [suppliers, setSuppliers] = useState(() => loadLocalStorage('APP_TURNI_SUPPLIERS', []));

  // Salvataggio automatico in localStorage ad ogni modifica
  useEffect(() => {
    saveLocalStorage('APP_TURNI_INVENTORY_ITEMS', inventoryItems);
  }, [inventoryItems]);

  useEffect(() => {
    saveLocalStorage('APP_TURNI_INVOICES', invoices);
  }, [invoices]);

  useEffect(() => {
    saveLocalStorage('APP_TURNI_SUPPLIERS', suppliers);
  }, [suppliers]);

  // Caricamento dati remoti da Supabase (se configurato)
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      // Fetch Inventory Items
      const { data: itemsData, error: itemsErr } = await supabase.from('inventory_items').select('*').order('name');
      if (!itemsErr && itemsData && itemsData.length > 0) {
        setInventoryItems(itemsData);
      }

      // Fetch Invoices
      const { data: invData, error: invErr } = await supabase.from('invoices').select('*, items:invoice_items(*)').order('created_at', { ascending: false });
      if (!invErr && invData && invData.length > 0) {
        const formattedInvoices = invData.map((inv) => ({
          id: inv.id,
          supplier_name: inv.supplier_name_raw || 'Fornitore',
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          due_date: inv.due_date,
          total_amount: inv.total_amount,
          payment_status: inv.payment_status,
          notes: inv.notes,
          items: (inv.items || []).map((it) => ({
            item_name: it.item_name_raw,
            quantity: it.quantity,
            unit_of_measure: it.unit_of_measure || 'cartoni',
            pieces_per_package: it.pieces_per_package || 1,
            unit_price: it.unit_price,
            total_price: it.total_price,
          })),
        }));
        setInvoices(formattedInvoices);
      }

      // Fetch Suppliers
      const { data: supData, error: supErr } = await supabase.from('suppliers').select('*').order('name');
      if (!supErr && supData && supData.length > 0) {
        setSuppliers(supData);
      }
    } catch (err) {
      console.log('Utilizzo dati locali di magazzino:', err);
    }
  };

  // Aggiornamento Giacenza Manuale
  const handleUpdateStock = async (itemId, newStock) => {
    setInventoryItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, current_stock: newStock } : i))
    );

    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.from('inventory_items').update({ current_stock: newStock }).eq('id', itemId);
      }
    } catch (err) {
      console.warn('Aggiornamento stock salvato in locale');
    }
  };

  // Modifica Completa Ingrediente
  const handleEditItem = async (updatedItem) => {
    setInventoryItems((prev) =>
      prev.map((i) => (i.id === updatedItem.id ? updatedItem : i))
    );

    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.from('inventory_items').update({
          name: updatedItem.name,
          category: updatedItem.category,
          unit_of_measure: updatedItem.unit_of_measure,
          current_stock: updatedItem.current_stock,
          min_stock_alert: updatedItem.min_stock_alert,
          last_unit_price: updatedItem.last_unit_price,
        }).eq('id', updatedItem.id);
      }
    } catch (err) {
      console.warn('Ingrediente aggiornato in locale');
    }
  };

  // Eliminazione Ingrediente
  const handleDeleteItem = async (itemId) => {
    setInventoryItems((prev) => prev.filter((i) => i.id !== itemId));

    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.from('inventory_items').delete().eq('id', itemId);
      }
    } catch (err) {
      console.warn('Ingrediente eliminato in locale');
    }
  };

  // Modifica Completa Fattura
  const handleEditInvoice = async (updatedInvoice) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === updatedInvoice.id ? updatedInvoice : inv))
    );

    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.from('invoices').update({
          supplier_name_raw: updatedInvoice.supplier_name,
          invoice_number: updatedInvoice.invoice_number,
          invoice_date: updatedInvoice.invoice_date,
          due_date: updatedInvoice.due_date,
          total_amount: updatedInvoice.total_amount,
          payment_status: updatedInvoice.payment_status,
          notes: updatedInvoice.notes,
        }).eq('id', updatedInvoice.id);
      }
    } catch (err) {
      console.warn('Fattura aggiornata in locale');
    }
  };

  // Eliminazione Fattura
  const handleDeleteInvoice = async (invoiceId) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));

    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.from('invoices').delete().eq('id', invoiceId);
      }
    } catch (err) {
      console.warn('Fattura eliminata in locale');
    }
  };

  // Aggiunta Nuovo Ingrediente
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Latticini');
  const [newItemUnit, setNewItemUnit] = useState('kg');
  const [newItemPiecesPerPackage, setNewItemPiecesPerPackage] = useState('24');
  const [newItemStock, setNewItemStock] = useState('10');
  const [newItemMinStock, setNewItemMinStock] = useState('5');

  const handleCreateNewItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const newItem = {
      id: `item-${Date.now()}`,
      name: newItemName.trim(),
      category: newItemCategory,
      unit_of_measure: newItemUnit,
      pieces_per_package: parseInt(newItemPiecesPerPackage) || 1,
      current_stock: parseFloat(newItemStock) || 0,
      min_stock_alert: parseFloat(newItemMinStock) || 0,
      last_unit_price: 0,
    };

    setInventoryItems((prev) => [...prev, newItem]);
    setShowNewItemModal(false);
    setNewItemName('');

    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.from('inventory_items').insert([{
          name: newItem.name,
          category: newItem.category,
          unit_of_measure: newItem.unit_of_measure,
          pieces_per_package: newItem.pieces_per_package,
          current_stock: newItem.current_stock,
          min_stock_alert: newItem.min_stock_alert,
        }]);
      }
    } catch (err) {
      console.warn('Ingrediente aggiunto in locale');
    }
  };

  // Salvataggio Fattura & Auto-Carico Magazzino
  const handleSaveInvoice = async (invoicePayload) => {
    const newInvoiceId = `inv-${Date.now()}`;

    const newInvoiceObj = {
      id: newInvoiceId,
      supplier_name: invoicePayload.supplier_name,
      invoice_number: invoicePayload.invoice_number,
      invoice_date: invoicePayload.invoice_date,
      due_date: invoicePayload.due_date,
      total_amount: invoicePayload.total_amount,
      payment_status: invoicePayload.payment_status,
      items: invoicePayload.items,
    };

    // 1. Aggiungiamo la fattura all'archivio
    setInvoices((prev) => [newInvoiceObj, ...prev]);

    // 2. Incrementiamo automaticamente le giacenze dell'inventario!
    setInventoryItems((prevItems) => {
      const updated = [...prevItems];
      invoicePayload.items.forEach((item) => {
        let existingIdx = -1;

        // 1. Cerca per ID esplicito abbinato dall'utente
        if (item.target_item_id && item.target_item_id !== 'new') {
          existingIdx = updated.findIndex((u) => u.id === item.target_item_id);
        }

        // 2. Se non trovato per ID, cerca per nome target o nome grezzo
        if (existingIdx === -1) {
          const nameToMatch = (item.target_item_name || item.item_name || '').trim().toLowerCase();
          existingIdx = updated.findIndex(
            (u) => u.name.trim().toLowerCase() === nameToMatch
          );
        }

        if (existingIdx >= 0) {
          // Incrementa quantità e aggiorna ultimo prezzo unitario
          const currentQty = Number(updated[existingIdx].current_stock) || 0;
          const addedQty = Number(item.quantity) || 0;
          updated[existingIdx] = {
            ...updated[existingIdx],
            current_stock: Number((currentQty + addedQty).toFixed(2)),
            last_unit_price: Number(item.unit_price) || updated[existingIdx].last_unit_price,
            pieces_per_package: Number(item.pieces_per_package) || updated[existingIdx].pieces_per_package || 1,
          };
        } else {
          // Se l'ingrediente è nuovo, lo crea con la categoria automatica corretta
          const finalName = item.target_item_name || item.item_name;
          const nameLower = (finalName || '').toLowerCase();
          let cat = 'Generale';
          if (/\b(mozzarella|fior di latte|provola|stracciatella|ricotta|formaggio|latte|burro|caciocavallo|parmigiano|grana|gorgonzola|bocconcini)\b/i.test(nameLower)) cat = 'Latticini';
          else if (/\b(farina|semola|lievito|grano|crusca)\b/i.test(nameLower)) cat = 'Farine';
          else if (/\b(pelati|pomodoro|datterini|passata|salsa|polpa|conserva|concentrato)\b/i.test(nameLower)) cat = 'Conserve';
          else if (/\b(prosciutto|salame|speck|pancetta|mortadella|ciccioli|wurstel|guanciale|coppa|bresaola|culatello)\b/i.test(nameLower)) cat = 'Salumi';
          else if (/\b(olio|aceto|sale|zucchero|spezie|origano|pepe|peperoncino|maionese|ketchup)\b/i.test(nameLower)) cat = 'Consumabili';
          else if (/\b(vino|birra|acqua|bibita|succo|coca|fanta|sprite|te|spumante|prosecco|liquore)\b/i.test(nameLower)) cat = 'Bevande';
          else if (/\b(friarielli|basilico|rucola|funghi|fungo|carciofi|melanzane|zucchine|patate|ortofruit|aglio|cipolla|limoni|arance)\b/i.test(nameLower)) cat = 'Ortofrutta';

          updated.push({
            id: `item-${Date.now()}-${Math.random().toString().slice(2, 6)}`,
            name: finalName,
            category: cat,
            unit_of_measure: item.unit_of_measure || 'cartoni',
            pieces_per_package: Number(item.pieces_per_package) || (cat === 'Bevande' ? 24 : 1),
            current_stock: Number(Number(item.quantity || 0).toFixed(2)),
            min_stock_alert: 5.0,
            last_unit_price: Number(item.unit_price) || 0,
          });
        }
      });
      return updated;
    });

    // Passiamo alla vista Archivio Fatture
    setActiveTab('archive');

    // Tentativo di salvataggio remoto su Supabase
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: invIns } = await supabase.from('invoices').insert([{
          supplier_name_raw: invoicePayload.supplier_name,
          invoice_number: invoicePayload.invoice_number,
          invoice_date: invoicePayload.invoice_date,
          due_date: invoicePayload.due_date,
          total_amount: invoicePayload.total_amount,
          payment_status: invoicePayload.payment_status,
        }]).select().single();

        if (invIns?.id && invoicePayload.items?.length > 0) {
          const itemRows = invoicePayload.items.map((it) => ({
            invoice_id: invIns.id,
            item_name_raw: it.item_name,
            quantity: it.quantity,
            unit_of_measure: it.unit_of_measure || 'cartoni',
            pieces_per_package: it.pieces_per_package || 1,
            unit_price: it.unit_price,
            total_price: it.total_price,
          }));
          await supabase.from('invoice_items').insert(itemRows);
        }
      }
    } catch (err) {
      console.warn('Fattura e carico magazzino salvati in locale');
    }
  };

  // Cambio Stato Pagamento Fattura
  const handleTogglePaymentStatus = async (invoiceId) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          const nextStatus =
            inv.payment_status === 'da_pagare'
              ? 'pagato'
              : inv.payment_status === 'pagato'
              ? 'scaduto'
              : 'da_pagare';
          return { ...inv, payment_status: nextStatus };
        }
        return inv;
      })
    );

    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const inv = invoices.find((i) => i.id === invoiceId);
        if (inv) {
          const nextStatus =
            inv.payment_status === 'da_pagare'
              ? 'pagato'
              : inv.payment_status === 'pagato'
              ? 'scaduto'
              : 'da_pagare';
          await supabase.from('invoices').update({ payment_status: nextStatus }).eq('id', invoiceId);
        }
      }
    } catch (err) {
      console.warn('Stato pagamento salvato in locale');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Intestazione Titolo & Gestione Fornitori */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
            Magazzino & Fatture
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Gestione giacenze, acquisto ingredienti e scansione fatture AI
          </p>
        </div>

        <button
          onClick={() => setShowSupplierModal(true)}
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: '0.85rem' }}
        >
          <Truck size={18} />
          <span className="hide-mobile">Fornitori</span>
        </button>
      </div>

      {/* Tab Bar Interna (Giacenze / Scan AI / Archivio) */}
      <div
        className="glass-card"
        style={{
          padding: '6px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '6px',
          borderRadius: '16px',
        }}
      >
        <button
          onClick={() => setActiveTab('inventory')}
          style={{
            padding: '10px 14px',
            borderRadius: '12px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            background: activeTab === 'inventory' ? '#38bdf8' : 'transparent',
            color: activeTab === 'inventory' ? '#0f172a' : '#94a3b8',
          }}
        >
          <Package size={18} />
          <span>Giacenze ({inventoryItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('scan')}
          style={{
            padding: '10px 14px',
            borderRadius: '12px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            background: activeTab === 'scan' ? '#38bdf8' : 'transparent',
            color: activeTab === 'scan' ? '#0f172a' : '#94a3b8',
          }}
        >
          <Sparkles size={18} />
          <span>Nuova Consegna AI</span>
        </button>

        <button
          onClick={() => setActiveTab('archive')}
          style={{
            padding: '10px 14px',
            borderRadius: '12px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            background: activeTab === 'archive' ? '#38bdf8' : 'transparent',
            color: activeTab === 'archive' ? '#0f172a' : '#94a3b8',
          }}
        >
          <FileText size={18} />
          <span>Fatture ({invoices.length})</span>
        </button>
      </div>

      {/* Vista Contenuto Selezionato */}
      {activeTab === 'inventory' && (
        <InventoryList
          items={inventoryItems}
          onUpdateStock={handleUpdateStock}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
          onAddNewItem={() => setShowNewItemModal(true)}
          onNavigateToScan={() => setActiveTab('scan')}
          onOpenPriceHistory={(item) => setSelectedPriceHistoryItem(item)}
        />
      )}

      {activeTab === 'scan' && (
        <InvoiceScanForm
          suppliers={suppliers}
          inventoryItems={inventoryItems}
          onSaveInvoice={handleSaveInvoice}
          onCancel={() => setActiveTab('inventory')}
        />
      )}

      {activeTab === 'archive' && (
        <InvoiceArchive
          invoices={invoices}
          onTogglePaymentStatus={handleTogglePaymentStatus}
          onEditInvoice={handleEditInvoice}
          onDeleteInvoice={handleDeleteInvoice}
        />
      )}

      {/* Modale Creazione Nuovo Ingrediente */}
      {showNewItemModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '420px', padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>
              Aggiungi Nuovo Ingrediente
            </h3>

            <form onSubmit={handleCreateNewItem} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="input-label">Nome Ingrediente *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="es. Salsa Barbecue, Funghi Porcini"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">Categoria</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  >
                    <option value="Latticini">Latticini</option>
                    <option value="Farine">Farine</option>
                    <option value="Conserve">Conserve</option>
                    <option value="Salumi">Salumi</option>
                    <option value="Bevande">Bevande</option>
                    <option value="Consumabili">Consumabili</option>
                    <option value="Generale">Generale</option>
                  </select>
                </div>

                <div>
                  <label className="input-label">Unità Misura</label>
                  <select
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
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
              </div>

              {['cartoni', 'ct', 'cf', 'casse', 'confezioni'].includes((newItemUnit || '').toLowerCase()) && (
                <div>
                  <label className="input-label" style={{ color: '#38bdf8' }}>Pezzi per Cartone / Cassa (qxc) *</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={newItemPiecesPerPackage}
                    onChange={(e) => setNewItemPiecesPerPackage(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8', fontWeight: 700 }}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">Giacenza Iniziale</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItemStock}
                    onChange={(e) => setNewItemStock(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label className="input-label">Soglia Avviso Minima</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItemMinStock}
                    onChange={(e) => setNewItemMinStock(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewItemModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Annulla
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  Salva Ingrediente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Gestione Fornitori */}
      {showSupplierModal && (
        <SupplierModal
          suppliers={suppliers}
          onAddSupplier={(newSup) =>
            setSuppliers((prev) => [...prev, { ...newSup, id: `sup-${Date.now()}` }])
          }
          onDeleteSupplier={(id) => setSuppliers((prev) => prev.filter((s) => s.id !== id))}
          onClose={() => setShowSupplierModal(false)}
        />
      )}

      {/* Modale Storico Prezzi & Fornitori per Ingrediente */}
      {selectedPriceHistoryItem && (
        <PriceHistoryModal
          item={selectedPriceHistoryItem}
          invoices={invoices}
          onClose={() => setSelectedPriceHistoryItem(null)}
        />
      )}
    </div>
  );
}
