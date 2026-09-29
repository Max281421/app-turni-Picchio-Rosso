import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import InventoryList from './InventoryList';
import InvoiceScanForm from './InvoiceScanForm';
import InvoiceArchive from './InvoiceArchive';
import SupplierModal from './SupplierModal';
import PriceHistoryModal from './PriceHistoryModal';
import { Package, Sparkles, FileText, Truck, Plus } from 'lucide-react';

export default function InventoryDashboard() {
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'scan' | 'archive'
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [selectedPriceHistoryItem, setSelectedPriceHistoryItem] = useState(null);

  // State Dati
  const [inventoryItems, setInventoryItems] = useState([
    { id: '1', name: 'Mozzarella di Bufala DOP', category: 'Latticini', unit_of_measure: 'kg', current_stock: 25.0, min_stock_alert: 10.0, last_unit_price: 8.5 },
    { id: '2', name: 'Fior di Latte Appennino', category: 'Latticini', unit_of_measure: 'kg', current_stock: 40.0, min_stock_alert: 15.0, last_unit_price: 6.2 },
    { id: '3', name: 'Farina Tipo 00 Pizza', category: 'Farine', unit_of_measure: 'kg', current_stock: 150.0, min_stock_alert: 50.0, last_unit_price: 1.1 },
    { id: '4', name: 'Pelati San Marzano DOP', category: 'Conserve', unit_of_measure: 'kg', current_stock: 60.0, min_stock_alert: 20.0, last_unit_price: 2.3 },
    { id: '5', name: 'Olio Extra Vergine di Oliva', category: 'Consumabili', unit_of_measure: 'litri', current_stock: 18.0, min_stock_alert: 5.0, last_unit_price: 9.8 },
    { id: '6', name: 'Prosciutto Crudo di Parma', category: 'Salumi', unit_of_measure: 'kg', current_stock: 8.5, min_stock_alert: 3.0, last_unit_price: 18.5 },
  ]);

  const [invoices, setInvoices] = useState([
    {
      id: 'inv-1',
      supplier_name: 'Latticini Rossi Srl',
      invoice_number: 'FT-2026/098',
      invoice_date: '2026-09-20',
      total_amount: 245.5,
      payment_status: 'pagato',
      items: [
        { item_name: 'Mozzarella di Bufala DOP', quantity: 15, unit_of_measure: 'kg', total_price: 127.5, unit_price: 8.5 },
        { item_name: 'Fior di Latte Appennino', quantity: 10, unit_of_measure: 'kg', total_price: 62.0, unit_price: 62.0 / 10 },
      ],
    },
  ]);

  const [suppliers, setSuppliers] = useState([
    { id: 'sup-1', name: 'Latticini Rossi Srl', phone: '081-5551234', email: 'ordini@latticinirossi.it' },
    { id: 'sup-2', name: 'Mulino Capriati SpA', phone: '0823-777888', email: 'commerciale@mulinocapriati.it' },
  ]);

  // Caricamento dati da Supabase
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
        setInvoices(invData);
      }

      // Fetch Suppliers
      const { data: supData, error: supErr } = await supabase.from('suppliers').select('*').order('name');
      if (!supErr && supData && supData.length > 0) {
        setSuppliers(supData);
      }
    } catch (err) {
      console.log('Utilizzo dati iniziali di fallback magazzino:', err);
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
        const existingIdx = updated.findIndex(
          (u) => u.name.toLowerCase() === item.item_name.toLowerCase()
        );

        if (existingIdx >= 0) {
          // Incrementa quantità e aggiorna ultimo prezzo al kg
          const currentQty = Number(updated[existingIdx].current_stock) || 0;
          const addedQty = Number(item.quantity) || 0;
          updated[existingIdx] = {
            ...updated[existingIdx],
            current_stock: currentQty + addedQty,
            last_unit_price: Number(item.unit_price) || updated[existingIdx].last_unit_price,
          };
        } else {
          // Se l'ingrediente è nuovo, lo crea al volo nell'inventario
          updated.push({
            id: `item-${Date.now()}-${Math.random()}`,
            name: item.item_name,
            category: 'Generale',
            unit_of_measure: item.unit_of_measure || 'kg',
            current_stock: Number(item.quantity) || 0,
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
            justify: 'center',
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
            justify: 'center',
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
            justify: 'center',
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
                    <option value="kg">kg</option>
                    <option value="litri">litri</option>
                    <option value="buste">buste</option>
                    <option value="cartoni">cartoni</option>
                    <option value="pezzi">pezzi</option>
                  </select>
                </div>
              </div>

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
