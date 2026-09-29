import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Truck, ArrowUpRight, ArrowDownRight, X, BarChart2 } from 'lucide-react';

export default function PriceHistoryModal({ item, invoices, onClose }) {
  if (!item) return null;

  // 1. Estraiamo tutti i movimenti d'acquisto storici dell'ingrediente dalle fatture
  const historyRecords = [];

  invoices.forEach((inv) => {
    if (!inv.items || !Array.isArray(inv.items)) return;

    inv.items.forEach((it) => {
      // Confrontiamo il nome dell'ingrediente o l'ID se presente
      const matchesName = it.item_name && it.item_name.toLowerCase() === item.name.toLowerCase();
      const matchesId = it.inventory_item_id && it.inventory_item_id === item.id;

      if (matchesName || matchesId) {
        const qty = Number(it.quantity) || 0;
        const tot = Number(it.total_price) || 0;
        const unitP = it.unit_price ? Number(it.unit_price) : qty > 0 ? tot / qty : 0;

        historyRecords.push({
          invoice_id: inv.id,
          supplier_name: inv.supplier_name || 'Fornitore Generico',
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date || 'Data N.D.',
          quantity: qty,
          unit_of_measure: it.unit_of_measure || item.unit_of_measure || 'kg',
          total_price: tot,
          unit_price: Number(unitP.toFixed(2)),
          timestamp: new Date(inv.invoice_date).getTime() || 0,
        });
      }
    });
  });

  // Ordiniamo la cronologia dal più recente al più vecchio
  historyRecords.sort((a, b) => b.timestamp - a.timestamp);

  // Calcoliamo la variazione percentuale rispetto all'acquisto precedente per ogni riga
  const enrichedRecords = historyRecords.map((rec, idx) => {
    let priceChangePct = null;
    let trend = 'neutral';

    // Il record successivo nell'array ordinato (b.timestamp - a.timestamp) è l'acquisto precedente nel tempo
    const prevRecord = historyRecords[idx + 1];
    if (prevRecord && prevRecord.unit_price > 0) {
      const diff = rec.unit_price - prevRecord.unit_price;
      priceChangePct = Number(((diff / prevRecord.unit_price) * 100).toFixed(1));
      if (priceChangePct > 0) trend = 'up';
      else if (priceChangePct < 0) trend = 'down';
    }

    return { ...rec, priceChangePct, trend };
  });

  // 2. Raggruppiamo i dati per Fornitore per fare il confronto tra fornitori
  const supplierStatsMap = {};

  historyRecords.forEach((rec) => {
    const supName = rec.supplier_name;
    if (!supplierStatsMap[supName]) {
      supplierStatsMap[supName] = {
        supplier_name: supName,
        latest_unit_price: rec.unit_price,
        latest_date: rec.invoice_date,
        min_price: rec.unit_price,
        max_price: rec.unit_price,
        purchase_count: 1,
        unit_of_measure: rec.unit_of_measure,
      };
    } else {
      const existing = supplierStatsMap[supName];
      existing.purchase_count += 1;
      if (rec.unit_price < existing.min_price) existing.min_price = rec.unit_price;
      if (rec.unit_price > existing.max_price) existing.max_price = rec.unit_price;
    }
  });

  const supplierStats = Object.values(supplierStatsMap);

  // 3. Calcolo metriche generali dell'ingrediente
  const pricesList = historyRecords.map((r) => r.unit_price);
  const minPrice = pricesList.length > 0 ? Math.min(...pricesList) : Number(item.last_unit_price || 0);
  const maxPrice = pricesList.length > 0 ? Math.max(...pricesList) : Number(item.last_unit_price || 0);
  const avgPrice =
    pricesList.length > 0
      ? Number((pricesList.reduce((a, b) => a + b, 0) / pricesList.length).toFixed(2))
      : Number(item.last_unit_price || 0);
  const latestPrice = pricesList.length > 0 ? pricesList[0] : Number(item.last_unit_price || 0);

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ maxWidth: '650px', padding: '24px' }}>
        {/* Header Modale */}
        <div className="modal-header-sticky" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <BarChart2 size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                Storico Prezzi & Fornitori
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Materia Prima: <strong style={{ color: '#38bdf8' }}>{item.name}</strong> ({item.unit_of_measure})
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Metriche Sintetiche dell'Ingrediente */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            <div
              style={{
                padding: '10px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Ultimo Prezzo</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
                € {latestPrice.toFixed(2)}
              </div>
            </div>

            <div
              style={{
                padding: '10px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 600 }}>Prezzo Minimo</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
                € {minPrice.toFixed(2)}
              </div>
            </div>

            <div
              style={{
                padding: '10px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 600 }}>Prezzo Massimo</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f87171', marginTop: '2px' }}>
                € {maxPrice.toFixed(2)}
              </div>
            </div>

            <div
              style={{
                padding: '10px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#cbd5e1', fontWeight: 600 }}>Prezzo Medio</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#cbd5e1', marginTop: '2px' }}>
                € {avgPrice.toFixed(2)}
              </div>
            </div>
          </div>

          {/* 1. Tabella Confronto tra Fornitori */}
          <div>
            <h4
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#f8fafc',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Truck size={16} style={{ color: '#38bdf8' }} />
              Confronto Prezzi tra Fornitori ({supplierStats.length})
            </h4>

            {supplierStats.length === 0 ? (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                  textAlign: 'center',
                }}
              >
                Nessun acquisto fornitore registrato nelle fatture per questo ingrediente.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {supplierStats.map((sup, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>
                        {sup.supplier_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                        Ultima consegna: {sup.latest_date} • {sup.purchase_count} {sup.purchase_count === 1 ? 'consegna' : 'consegne'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
                        € {sup.latest_unit_price.toFixed(2)} /{sup.unit_of_measure}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                        Range: € {sup.min_price.toFixed(2)} - € {sup.max_price.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Timeline Cronologia Variazione Prezzi */}
          <div>
            <h4
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#f8fafc',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Calendar size={16} style={{ color: '#38bdf8' }} />
              Cronologia Variazione Prezzi nel Tempo ({enrichedRecords.length})
            </h4>

            {enrichedRecords.length === 0 ? (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                  textAlign: 'center',
                }}
              >
                Registra fatture fornitori contenenti questo ingrediente per visualizzare l'evoluzione storica dei prezzi.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                {enrichedRecords.map((rec, idx) => {
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f8fafc' }}>
                          {rec.supplier_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                          Data: {rec.invoice_date} • Fattura: {rec.invoice_number} • Qty: {rec.quantity} {rec.unit_of_measure}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>
                            € {rec.unit_price.toFixed(2)} <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>/{rec.unit_of_measure}</span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>
                            Tot: € {rec.total_price.toFixed(2)}
                          </div>
                        </div>

                        {/* Badge Variazione Percentuale */}
                        {rec.priceChangePct !== null && (
                          <div
                            style={{
                              padding: '4px 8px',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              background:
                                rec.trend === 'up'
                                  ? 'rgba(239, 68, 68, 0.15)'
                                  : rec.trend === 'down'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : 'rgba(255, 255, 255, 0.1)',
                              color:
                                rec.trend === 'up'
                                  ? '#f87171'
                                  : rec.trend === 'down'
                                  ? '#34d399'
                                  : '#cbd5e1',
                              border:
                                rec.trend === 'up'
                                  ? '1px solid rgba(239, 68, 68, 0.3)'
                                  : rec.trend === 'down'
                                  ? '1px solid rgba(16, 185, 129, 0.3)'
                                  : '1px solid rgba(255, 255, 255, 0.2)',
                            }}
                          >
                            {rec.trend === 'up' && <ArrowUpRight size={14} />}
                            {rec.trend === 'down' && <ArrowDownRight size={14} />}
                            {rec.priceChangePct > 0 ? `+${rec.priceChangePct}%` : `${rec.priceChangePct}%`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
