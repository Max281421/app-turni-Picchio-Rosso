import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSupabaseClient } from '../lib/supabase';
import MonthPicker from '../components/MonthPicker';
import ShiftModal from '../components/ShiftModal';
import ProfileModal from '../components/ProfileModal';
import { exportShiftsToExcel } from '../lib/excelExport';
import { exportSummaryToPDF, exportGridToPDF } from '../lib/pdfExport';
import { parseMansioni } from '../lib/whatsappExport';
import { FileSpreadsheet, FileText, Users, Sun, Moon, Calendar as CalendarIcon, Search, UserCheck, ChevronDown, ChevronUp, Plus, Edit2, X, AlertTriangle, Settings } from 'lucide-react';

export default function AdminDashboard() {
  const { employee, updateEmployeeRole, updateEmployeeName, updateEmployeeMansioni, deleteAccount } = useAuth();
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [expandedEmpId, setExpandedEmpId] = useState(null);

  // Edit Employee Account Modal for Admin
  const [editingEmpForAdmin, setEditingEmpForAdmin] = useState(null);

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
      const enrichedEmps = (empData || []).map(e => ({
        ...e,
        mansioni: parseMansioni(e.mansioni, e.id || e.auth_user_id)
      }));
      setEmployees(enrichedEmps);

      // 1. Carica turni effettivi lavorati segnati dai dipendenti
      const { data: shiftData, error: shiftErr } = await supabase
        .from('shifts')
        .select('*')
        .gte('data', startDate)
        .lte('data', endDate);

      if (shiftErr) console.error('Error fetching shifts:', shiftErr);

      // 2. Carica i turni pianificati ufficialmente dall'Admin per il controllo incrociato
      let plannedSet = new Set();
      try {
        const { data: plannedData } = await supabase
          .from('planned_shifts')
          .select('*')
          .gte('data', startDate)
          .lte('data', endDate);

        if (plannedData) {
          plannedData.forEach(p => {
            plannedSet.add(`${p.employee_id}_${p.data}_${p.turno}`);
          });
        }
      } catch (pErr) {
        console.warn('Error fetching planned_shifts for cross-check:', pErr);
      }

      // Integrazione con LocalStorage backup per le mappe settimanali dei planning
      try {
        for (let d = 1; d <= daysInMonth; d += 7) {
          const dateObj = new Date(currentYear, currentMonth, d);
          const dayOfWeek = dateObj.getDay();
          const diff = dateObj.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          const mon = new Date(dateObj.setDate(diff));
          const monStr = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;

          const savedLocal = localStorage.getItem(`APP_TURNI_PLANNED_MAP_${monStr}`);
          if (savedLocal) {
            const parsedMap = JSON.parse(savedLocal);
            Object.keys(parsedMap).forEach(k => {
              const parts = k.split('_');
              if (parts.length >= 3) {
                plannedSet.add(`${parts[0]}_${parts[1]}_${parts[2]}`);
              }
            });
          }
        }
      } catch (e) {}

      // 3. Arricchisci i turni dei dipendenti con flag isExtra e note
      const enrichedShifts = (shiftData || []).map(s => {
        const savedNote = localStorage.getItem(`APP_TURNI_NOTE_${s.employee_id}_${s.data}`) || '';
        const isPlanned = plannedSet.has(`${s.employee_id}_${s.data}_${s.turno}`);
        return {
          ...s,
          note: s.note || savedNote || '',
          isExtra: !isPlanned
        };
      });

      setShifts(enrichedShifts);
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
  const extraShiftsCount = shifts.filter((s) => s.isExtra).length;
  const employeesWithExtraCount = new Set(shifts.filter((s) => s.isExtra).map((s) => s.employee_id)).size;

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

      {/* Warning Alert Banner for Discrepancies */}
      {extraShiftsCount > 0 && (
        <div className="glass-card" style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 4px 20px rgba(239, 68, 68, 0.15)'
        }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.25)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <AlertTriangle size={24} color="#f87171" />
          </div>
          <div>
            <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#f87171', margin: '0 0 2px 0' }}>
              ⚠️ Discrepanze Rilevate: {extraShiftsCount} {extraShiftsCount === 1 ? 'turno non presente' : 'turni non presenti'} a planning ({employeesWithExtraCount} {employeesWithExtraCount === 1 ? 'dipendente' : 'dipendenti'})
            </h4>
            <p style={{ fontSize: '0.83rem', color: '#fca5a5', margin: 0 }}>
              Attenzione: alcuni dipendenti hanno registrato turni effettivi non presenti nella pianificazione settimanale dell'Admin. Espandi le schede dipendenti per verificare i dettagli e le eventuali note motivazionali.
            </p>
          </div>
        </div>
      )}

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
            const empExtraCount = empShifts.filter((s) => s.isExtra).length;
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
                    {/* Discrepancy Badge */}
                    {empExtraCount > 0 ? (
                      <span style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#fbbf24',
                        background: 'rgba(245, 158, 11, 0.2)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }} title="Turni segnati dal dipendente non presenti nel planning confermato dall'Admin">
                        <AlertTriangle size={13} color="#fbbf24" />
                        {empExtraCount} Non a planning
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: '#4ade80',
                        background: 'rgba(34, 197, 94, 0.15)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        padding: '4px 10px',
                        borderRadius: '20px'
                      }}>
                        🟢 Conforme
                      </span>
                    )}

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
                          onClick={() => setEditingEmpForAdmin(emp)}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Settings size={14} color="#38bdf8" />
                          Modifica Account
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
                            const isDayExtra = dayShifts.some((s) => s.isExtra);
                            const dayNote = dayShifts.find((s) => s.note)?.note;

                            return (
                              <div
                                key={dateStr}
                                onClick={() => handleOpenEditShift(emp, dateStr)}
                                style={{
                                  padding: '10px 14px',
                                  borderRadius: '8px',
                                  background: isDayExtra ? 'rgba(239, 68, 68, 0.12)' : 'rgba(30, 41, 59, 0.8)',
                                  border: isDayExtra ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(255,255,255,0.06)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  gap: '6px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', textTransform: 'capitalize' }}>
                                    {formatted}
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {isDayExtra && (
                                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f87171', background: 'rgba(239, 68, 68, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                                        ⚠️ Extra
                                      </span>
                                    )}
                                    <Edit2 size={13} color="#64748b" />
                                  </div>
                                </div>

                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                  {hasP && <span className="badge-pranzo" style={{ fontSize: '0.7rem' }}>☀️ Pranzo</span>}
                                  {hasC && <span className="badge-cena" style={{ fontSize: '0.7rem' }}>🌙 Cena</span>}
                                </div>

                                {dayNote && (
                                  <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontStyle: 'italic', wordBreak: 'break-word', marginTop: '2px' }}>
                                    📝 "{dayNote}"
                                  </div>
                                )}
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

      {/* Modal Modifica Account Dipendente per Admin */}
      <ProfileModal
        isOpen={!!editingEmpForAdmin}
        onClose={() => setEditingEmpForAdmin(null)}
        targetEmployee={editingEmpForAdmin}
        onUpdated={fetchAdminData}
      />
    </div>
  );
}
