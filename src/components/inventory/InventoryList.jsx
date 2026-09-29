import React, { useState } from 'react';
import { Search, Plus, AlertTriangle, Edit3, Trash2, X, Check, BarChart2 } from 'lucide-react';

export default function InventoryList({
  items,
  onUpdateStock,
  onEditItem,
  onDeleteItem,
  onAddNewItem,
  onNavigateToScan,
  onOpenPriceHistory,
}) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tutti');
  const [editingItem, setEditingItem] = useState(null);

  // Form State Modifica Ingrediente
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('Generale');
  const [editUnit, setEditUnit] = useState('kg');
  const [editStock, setEditStock] = useState('0');
  const [editMinStock, setEditMinStock] = useState('5');
  const [editPrice, setEditPrice] = useState('0');

  const categories = ['Tutti', ...new Set(items.map((i) => i.category || 'Generale'))];

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'Tutti' || item.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const lowStockCount = items.filter(
    (i) => Number(i.current_stock) <= Number(i.min_stock_alert)
  ).length;

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setEditName(item.name || '');
    setEditCategory(item.category || 'Generale');
    setEditUnit(item.unit_of_measure || 'kg');
    setEditStock(item.current_stock?.toString() || '0');
    setEditMinStock(item.min_stock_alert?.toString() || '5');
    setEditPrice(item.last_unit_price?.toString() || '0');
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingItem || !editName.trim()) return;

    const updated = {
      ...editingItem,
      name: editName.trim(),
      category: editCategory,
      unit_of_measure: editUnit,
      current_stock: parseFloat(editStock) || 0,
      min_stock_alert: parseFloat(editMinStock) || 0,
      last_unit_price: parseFloat(editPrice) || 0,
    };

    onEditItem(updated);
    setEditingItem(null);
  };

  const handleDelete = (item) => {
    if (window.confirm(`Sei sicuro di voler eliminare l'ingrediente "${item.name}" dall'inventario?`)) {
      onDeleteItem(item.id);
      setEditingItem(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Banner Avviso Scorte Minime */}
      {lowStockCount > 0 && (
        <div
          className="glass-card"
          style={{
            padding: '16px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f87171' }}>
                {lowStockCount} {lowStockCount === 1 ? 'Ingrediente in esaurimento' : 'Ingredienti in esaurimento'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                Scorte sotto la soglia minima impostata.
              </div>
            </div>
          </div>
          <button
            onClick={onNavigateToScan}
            className="btn-primary"
            style={{
              padding: '8px 14px',
              fontSize: '0.8rem',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            + Nuova Consegna
          </button>
        </div>
      )}

      {/* Controlli di Ricerca e Categorie */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
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
              placeholder="Cerca ingrediente (es. Mozzarella)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '42px', width: '100%' }}
            />
          </div>

          <button
            onClick={onAddNewItem}
            className="btn-primary"
            style={{ padding: '10px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <Plus size={18} />
            <span className="hide-mobile">Nuovo Ingrediente</span>
          </button>
        </div>

        {/* Pillole Filtro Categoria */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                background: selectedCategory === cat ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)',
                color: selectedCategory === cat ? '#0f172a' : '#94a3b8',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Lista Ingredienti / Giacenze */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredItems.length === 0 ? (
          <div
            className="glass-card"
            style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}
          >
            Nessun ingrediente trovato in questa categoria.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isLow = Number(item.current_stock) <= Number(item.min_stock_alert);
            return (
              <div
                key={item.id}
                className="glass-card"
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  borderLeft: isLow ? '4px solid #ef4444' : '4px solid #10b981',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
                      {item.name}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#cbd5e1',
                        fontWeight: 600,
                      }}
                    >
                      {item.category || 'Generale'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '14px', marginTop: '6px', fontSize: '0.8rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                    <span>
                      Ultimo prezzo: <strong style={{ color: '#38bdf8' }}>€ {Number(item.last_unit_price || 0).toFixed(2)} /{item.unit_of_measure}</strong>
                    </span>
                    <span>Soglia min: {item.min_stock_alert} {item.unit_of_measure}</span>
                  </div>
                </div>

                {/* Badge Giacenza & Tasto Modifica */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        color: isLow ? '#f87171' : '#34d399',
                      }}
                    >
                      {item.current_stock} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{item.unit_of_measure}</span>
                    </div>
                    {isLow && (
                      <div style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 700 }}>
                        In Esaurimento
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => onOpenPriceHistory && onOpenPriceHistory(item)}
                    title="Storico Prezzi & Fornitori"
                    style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '10px',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#38bdf8',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <BarChart2 size={16} />
                  </button>

                  <button
                    onClick={() => handleOpenEdit(item)}
                    title="Modifica Ingrediente"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '10px',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Edit3 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modale Modifica Completa / Eliminazione Ingrediente */}
      {editingItem && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '440px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                Modifica Ingrediente
              </h3>
              <button
                onClick={() => setEditingItem(null)}
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
                <label className="input-label">Nome Ingrediente *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">Categoria</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
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
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">Giacenza ({editUnit})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label className="input-label">Soglia Min</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editMinStock}
                    onChange={(e) => setEditMinStock(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label className="input-label">€ / {editUnit}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => handleDelete(editingItem)}
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
                >
                  <Check size={16} /> Salva Modifiche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
