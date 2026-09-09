import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSupabaseClient } from '../lib/supabase';
import MonthPicker from '../components/MonthPicker';
import ShiftModal from '../components/ShiftModal';
import { exportShiftsToExcel } from '../lib/excelExport';
import { exportSummaryToPDF, exportGridToPDF } from '../lib/pdfExport';
import { parseMansioni } from '../lib/whatsappExport';
import { FileSpreadsheet, FileText, Users, Sun, Moon, Calendar as CalendarIcon, Search, UserCheck, ChevronDown, ChevronUp, Plus, Edit2, X } from 'lucide-react';

export default function AdminDashboard() {
  const { updateEmployeeRole, updateEmployeeName, updateEmployeeMansioni, deleteAccount } = useAuth();
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [expandedEmpId, setExpandedEmpId] = useState(null);

  // Edit Sector Modal for Admin
  const [editingSectorEmp, setEditingSectorEmp] = useState(null);
  const [editingSectorMansioni, setEditingSectorMansioni] = useState([]);
  const [savingSectors, setSavingSectors] = useState(false);

  // Edit Modal for Admin
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    try {
      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .select('*')
        .order('nome', { ascending: true });

      if (empErr) console.error('Error fetching employees:', empErr);
      setEmployees(empData || []);

      const { data: shiftData, error: shiftErr } = await supabase
        .from('shifts')
        .select('*')
        .gte('data', startDate)
        .lte('data', endDate);

      if (shiftErr) console.error('Error fetching shifts:', shiftErr);
      setShifts(shiftData || []);
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const handleMonthChange = (year, month) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  const handleExportExcel = () => {
    const monthLabel = `${monthNames[currentMonth]} ${currentYear}`;
    exportShiftsToExcel(employees, shifts, monthLabel, currentYear, currentMonth);
  };

  const handleExportSummaryPDF = () => {
    const monthLabel = `${monthNames[currentMonth]} ${currentYear}`;
    exportSummaryToPDF(employees, shifts, monthLabel);
  };

  const handleExportGridPDF = () => {
    const monthLabel = `${monthNames[currentMonth]} ${currentYear}`;
    exportGridToPDF(employees, shifts, monthLabel, currentYear, currentMonth);
  };

  const handleOpenEditShift = (emp, dateStr) => {
    setSelectedEmp(emp);
    setSelectedDate(dateStr);
    setIsModalOpen(true);
  };

  const handleSaveShiftAdmin = async (dateStr, { pranzo, cena }) => {
    if (!selectedEmp?.id) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      await supabase
        .from('shifts')
        .delete()
        .eq('employee_id', selectedEmp.id)
        .eq('data', dateStr);

      const newRows = [];
      if (pranzo) newRows.push({ employee_id: selectedEmp.id, data: dateStr, turno: 'pranzo' });
      if (cena) newRows.push({ employee_id: selectedEmp.id, data: dateStr, turno: 'cena' });

      if (newRows.length > 0) {
        await supabase.from('shifts').insert(newRows);
      }

      await fetchAdminData();
    } catch (err) {
      console.error('Admin save shift error:', err);
    }
  };

  const handleDeleteShiftAdmin = async (dateStr) => {
    if (!selectedEmp?.id) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      await supabase
        .from('shifts')
        .delete()
        .eq('employee_id', selectedEmp.id)
        .eq('data', dateStr);

      await fetchAdminData();
    } catch (err) {
      console.error('Admin delete shift error:', err);
    }
  };

  // Filtered employees
  const filteredEmployees = employees.filter((emp) =>
    (emp.nome || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Overall totals
  const totalPranziAll = shifts.filter((s) => s.turno === 'pranzo').length;
  const totalCeneAll = shifts.filter((s) => s.turno === 'cena').length;
  const totalTurniAll = shifts.length;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 16px 40px' }}>
      
      {/* Month Selector & Export Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
        <MonthPicker
          currentYear={currentYear}
          currentMonth={currentMonth}
          onChange={handleMonthChange}
        />

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={handleExportExcel}
            className="btn-primary"
            style={{ padding: '10px 14px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
          >
            <FileSpreadsheet size={16} />
            Excel (.xlsx)
          </button>

          <button
            onClick={handleExportSummaryPDF}
            className="btn-primary"
            style={{ padding: '10px 14px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
          >
            <FileText size={16} />
            PDF Riepilogo
          </button>

          <button
            onClick={handleExportGridPDF}
            className="btn-primary"
            style={{ padding: '10px 14px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
          >
            <FileText size={16} />
            PDF Griglia (1-31)
          </button>
        </div>
      </div>

      {/* Global Counters */}
      <div className="stats-grid">
        <div className="glass-card stat-card">
          <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '10px', borderRadius: '10px' }}>
            <Users size={20} color="#38bdf8" />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Dipendenti Registrati</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{employees.length}</h3>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '10px', borderRadius: '10px' }}>
            <Sun size={20} color="#fbbf24" />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Totale Pranzi Mese</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{totalPranziAll}</h3>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '10px', borderRadius: '10px' }}>
            <Moon size={20} color="#a5b4fc" />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Totale Cene Mese</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{totalCeneAll}</h3>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div style={{ background: 'rgba(34, 197, 94, 0.15)', padding: '10px', borderRadius: '10px' }}>
            <CalendarIcon size={20} color="#4ade80" />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Totale Turni</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{totalTurniAll}</h3>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card" style={{ padding: '14px 20px', marginBottom: '20px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Cerca dipendente per nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="glass-input"
            style={{ paddingLeft: '42px' }}
          />
        </div>
      </div>

      {/* Employee List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          Caricamento riepilogo in corso...
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="glass-card" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
          Nessun dipendente trovato.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredEmployees.map((emp) => {
            const empShifts = shifts.filter((s) => s.employee_id === emp.id);
            const pranzi = empShifts.filter((s) => s.turno === 'pranzo').length;
            const cene = empShifts.filter((s) => s.turno === 'cena').length;
            const uniqueDates = new Set(empShifts.map((s) => s.data)).size;
            const isExpanded = expandedEmpId === emp.id;

            return (
              <div key={emp.id} className="glass-card" style={{ overflow: 'hidden' }}>
                
                {/* Employee Row Header */}
                <div
                  onClick={() => setExpandedEmpId(isExpanded ? null : emp.id)}
                  style={{
                    padding: '18px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    gap: '16px',
                    flexWrap: 'wrap',
                    background: isExpanded ? 'rgba(30, 41, 59, 0.9)' : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ background: 'rgba(129, 140, 248, 0.15)', padding: '10px', borderRadius: '50%' }}>
                      <UserCheck size={20} color="#818cf8" />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                        {emp.nome || 'Senza nome'} {emp.alias ? `(${emp.alias})` : ''}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {emp.ruolo === 'admin' ? 'Amministratore' : 'Dipendente'}
                        </span>
                        <span style={{ color: '#475569' }}>•</span>
                        {(() => {
                          const isSelf = employee && (
                            emp.id === employee.id ||
                            emp.auth_user_id === employee.auth_user_id ||
                            emp.id === employee.auth_user_id ||
                            emp.auth_user_id === employee.id
                          );
                          const targetMansioni = isSelf && employee.mansioni ? employee.mansioni : emp.mansioni;
                          const mans = parseMansioni(targetMansioni);
                          return (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {mans.includes('cassa') && <span style={{ fontSize: '0.75rem' }} title="Cassa">💵</span>}
                              {mans.includes('fattorino') && <span style={{ fontSize: '0.75rem' }} title="Fattorino">🛵</span>}
                              {mans.includes('pizzeria') && <span style={{ fontSize: '0.75rem' }} title="Pizzeria">🍕</span>}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Stat badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span className="badge-pranzo">
                      ☀️ {pranzi} Pranzi
                    </span>
                    <span className="badge-cena">
                      🌙 {cene} Cene
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', padding: '4px 12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '20px' }}>
                      Totale: <strong>{pranzi + cene}</strong> ({uniqueDates} gg)
                    </span>

                    {isExpanded ? <ChevronUp size={20} color="#94a3b8" /> : <ChevronDown size={20} color="#94a3b8" />}
                  </div>
                </div>

                {/* Expanded Details per Employee */}
                {isExpanded && (
                  <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15, 23, 42, 0.6)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <h5 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8' }}>
                        Dettaglio turni del mese di {monthNames[currentMonth]} {currentYear}
                      </h5>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => {
                            setEditingSectorEmp(emp);
                            setEditingSectorMansioni(parseMansioni(emp.mansioni));
                          }}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          Modifica Settori
                        </button>

                        <button
                          onClick={async () => {
                            const newRole = emp.ruolo === 'admin' ? 'dipendente' : 'admin';
                            if (confirm(`Vuoi cambiare il ruolo di ${emp.nome} in ${newRole.toUpperCase()}?`)) {
                              await updateEmployeeRole(emp.id, newRole);
                              await fetchAdminData();
                            }
                          }}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          Imposta come {emp.ruolo === 'admin' ? 'Dipendente' : 'Admin'}
                        </button>

                        <button
                          onClick={async () => {
                            const promptName = prompt(`Inserisci il nuovo Nome e Cognome per "${emp.nome}":`, emp.nome || '');
                            if (promptName && promptName.trim() !== '') {
                              await updateEmployeeName(emp.id, promptName.trim());
                              await fetchAdminData();
                            }
                          }}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Edit2 size={13} />
                          Modifica Nome
                        </button>

                        <button
                          onClick={async () => {
                            if (confirm(`Sei sicuro di voler ELIMINARE il dipendente "${emp.nome}"? Tutti i suoi turni verranno cancellati.`)) {
                              await deleteAccount(emp.id);
                              await fetchAdminData();
                            }
                          }}
                          className="btn-danger"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          Elimina Dipendente
                        </button>

                        <button
                          onClick={() => {
                            const datePrompt = prompt('Inserisci la data nel formato AAAA-MM-GG (es. 2026-05-15):');
                            if (datePrompt) handleOpenEditShift(emp, datePrompt);
                          }}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          <Plus size={14} />
                          Aggiungi Turno per Data
                        </button>
                      </div>
                    </div>

                    {empShifts.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                        Nessun turno registrato in questo mese per {emp.nome}.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                        {Array.from(new Set(empShifts.map((s) => s.data)))
                          .sort()
                          .map((dateStr) => {
                            const [y, m, d] = dateStr.split('-').map(Number);
                            const dateObj = new Date(y, m - 1, d);
                            const formatted = dateObj.toLocaleDateString('it-IT', {
                              weekday: 'short',
                              day: '2-digit',
                              month: 'short'
                            });
                            const dayShifts = empShifts.filter((s) => s.data === dateStr);
                            const hasP = dayShifts.some((s) => s.turno === 'pranzo');
                            const hasC = dayShifts.some((s) => s.turno === 'cena');

                            return (
                              <div
                                key={dateStr}
                                onClick={() => handleOpenEditShift(emp, dateStr)}
                                style={{
                                  padding: '10px 14px',
                                  borderRadius: '8px',
                                  background: 'rgba(30, 41, 59, 0.8)',
                                  border: '1px solid rgba(255,255,255,0.06)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer'
                                }}
                              >
                                <div>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', textTransform: 'capitalize' }}>
                                    {formatted}
                                  </span>
                                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                    {hasP && <span className="badge-pranzo" style={{ fontSize: '0.7rem' }}>☀️ Pranzo</span>}
                                    {hasC && <span className="badge-cena" style={{ fontSize: '0.7rem' }}>🌙 Cena</span>}
                                  </div>
                                </div>
                                <Edit2 size={14} color="#64748b" />
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Shift Modal */}
      <ShiftModal
        isOpen={isModalOpen}
        date={selectedDate}
        employeeName={selectedEmp?.nome}
        existingShifts={shifts.filter((s) => s.employee_id === selectedEmp?.id && s.data === selectedDate)}
        onSave={handleSaveShiftAdmin}
        onDelete={handleDeleteShiftAdmin}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Modal Modifica Settori Operativi per Admin */}
      {editingSectorEmp && (
        <div className="modal-overlay" onClick={() => setEditingSectorEmp(null)} style={{ zIndex: 1000 }}>
          <div className="glass-card modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px', maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                  Settori Operativi Pizzeria
                </h3>
                <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>
                  {editingSectorEmp.nome} {editingSectorEmp.alias ? `(${editingSectorEmp.alias})` : ''}
                </span>
              </div>
              <button onClick={() => setEditingSectorEmp(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '20px' }}>
              Seleziona uno o più settori in cui questo dipendente potrà operare durante la pianificazione settimanale.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {[
                { id: 'cassa', label: 'Cassa', icon: '💵', color: '#10b981' },
                { id: 'fattorino', label: 'Fattorino', icon: '🛵', color: '#38bdf8' },
                { id: 'pizzeria', label: 'Pizzeria', icon: '🍕', color: '#f59e0b' }
              ].map(sec => {
                const isSelected = editingSectorMansioni.includes(sec.id);
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      setEditingSectorMansioni(prev => {
                        if (prev.includes(sec.id)) {
                          if (prev.length === 1) return prev;
                          return prev.filter(m => m !== sec.id);
                        } else {
                          return [...prev, sec.id];
                        }
                      });
                    }}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: isSelected ? `2px solid ${sec.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                      background: isSelected ? `${sec.color}22` : 'rgba(15, 23, 42, 0.6)',
                      color: isSelected ? '#f8fafc' : '#94a3b8',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{sec.icon}</span>
                      {sec.label}
                    </span>
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: isSelected ? sec.color : '#64748b',
                      background: isSelected ? 'rgba(255,255,255,0.1)' : 'transparent',
                      padding: '4px 8px',
                      borderRadius: '6px'
                    }}>
                      {isSelected ? 'Abilitato ✓' : 'Disabilitato'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingSectorEmp(null)}
                className="btn-secondary"
                style={{ padding: '8px 14px', fontSize: '0.85rem' }}
              >
                Annulla
              </button>
              <button
                disabled={savingSectors}
                onClick={async () => {
                  setSavingSectors(true);
                  try {
                    await updateEmployeeMansioni(editingSectorEmp.id, editingSectorMansioni);
                    if (editingSectorEmp.auth_user_id && editingSectorEmp.auth_user_id !== editingSectorEmp.id) {
                      await updateEmployeeMansioni(editingSectorEmp.auth_user_id, editingSectorMansioni);
                    }
                    await fetchAdminData();
                    setEditingSectorEmp(null);
                  } catch (err) {
                    console.error(err);
                    alert('Errore durante il salvataggio dei settori.');
                  } finally {
                    setSavingSectors(false);
                  }
                }}
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: '0.85rem' }}
              >
                {savingSectors ? 'Salvataggio...' : 'Salva Settori'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
