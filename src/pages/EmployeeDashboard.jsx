import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSupabaseClient } from '../lib/supabase';
import MonthPicker from '../components/MonthPicker';
import ShiftModal from '../components/ShiftModal';
import PwaInstallPrompt from '../components/PwaInstallPrompt';
import { exportPersonalShiftPDF } from '../lib/pdfExport';
import { Sun, Moon, Calendar as CalendarIcon, Plus, CheckCircle2, Clock, Info, FileText } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function EmployeeDashboard() {
  const { employee, user } = useAuth();

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchShifts = useCallback(async () => {
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!user?.id || !supabase) {
      setLoading(false);
      return;
    }

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    try {
      // 1. Trova l'ID dipendente primario
      let empId = employee?.id;
      if (!empId) {
        const { data: empRecord } = await supabase
          .from('employees')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        empId = empRecord?.id;
      }

      if (empId) {
        const { data, error } = await supabase
          .from('shifts')
          .select('*')
          .eq('employee_id', empId)
          .gte('data', startDate)
          .lte('data', endDate);

        if (error) {
          console.error('Error loading shifts:', error);
        } else {
          const enriched = (data || []).map(s => {
            const savedNote = localStorage.getItem(`APP_TURNI_NOTE_${empId}_${s.data}`) || (user.id ? localStorage.getItem(`APP_TURNI_NOTE_${user.id}_${s.data}`) : '');
            return {
              ...s,
              note: s.note || savedNote || ''
            };
          });
          setShifts(enriched);
        }
      }
    } catch (err) {
      console.error('Fetch shifts exception:', err);
    } finally {
      setLoading(false);
    }
  }, [employee?.id, user?.id, currentYear, currentMonth]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const handleMonthChange = (year, month) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  const handleOpenDay = (dateStr) => {
    setSelectedDate(dateStr);
    setIsModalOpen(true);
  };

  const handleSaveShift = async (dateStr, { pranzo, cena, note }) => {
    const supabase = getSupabaseClient();
    if (!supabase || !user?.id) return;

    try {
      let empId = employee?.id || user.id;

      // Salva nota anche in LocalStorage backup
      try {
        if (note) {
          localStorage.setItem(`APP_TURNI_NOTE_${empId}_${dateStr}`, note);
          if (user.id) localStorage.setItem(`APP_TURNI_NOTE_${user.id}_${dateStr}`, note);
        } else {
          localStorage.removeItem(`APP_TURNI_NOTE_${empId}_${dateStr}`);
          if (user.id) localStorage.removeItem(`APP_TURNI_NOTE_${user.id}_${dateStr}`);
        }
      } catch (e) {}

      // 1. Rimuovi i turni precedenti per la data selezionata
      const { error: delErr } = await supabase
        .from('shifts')
        .delete()
        .eq('employee_id', empId)
        .eq('data', dateStr);

      if (delErr) {
        console.warn('Delete shift warning:', delErr);
      }

      // 3. Inserisci i nuovi turni scelti
      const newRows = [];
      if (pranzo) newRows.push({ employee_id: empId, data: dateStr, turno: 'pranzo', note: note || null });
      if (cena) newRows.push({ employee_id: empId, data: dateStr, turno: 'cena', note: note || null });

      if (newRows.length > 0) {
        let { error: insErr } = await supabase.from('shifts').insert(newRows);

        // Fallback per DB senza colonna note: riprova senza la proprietà note
        if (insErr && (insErr.code === 'PGRST204' || insErr.message?.includes('note') || insErr.code === '42703')) {
          const fallbackRows = newRows.map(({ note, ...rest }) => rest);
          const { error: retryErr } = await supabase.from('shifts').insert(fallbackRows);
          insErr = retryErr;
        }

        if (insErr) throw insErr;

        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.8 }
        });
      }

      await fetchShifts();
    } catch (err) {
      console.error('Error saving shift:', err);
      alert(`Errore durante il salvataggio dei turni: ${err.message || 'Verifica il database.'}`);
    }
  };

  const handleDeleteShift = async (dateStr) => {
    const supabase = getSupabaseClient();
    if (!supabase || !user?.id) return;

    try {
      let empId = employee?.id;
      const { data: realEmp } = await supabase
        .from('employees')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (realEmp?.id) empId = realEmp.id;

      if (empId) {
        await supabase
          .from('shifts')
          .delete()
          .eq('employee_id', empId)
          .eq('data', dateStr);
      }

      await fetchShifts();
    } catch (err) {
      console.error('Error deleting shift:', err);
    }
  };

  // Build days for month view
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dayShifts = shifts.filter((s) => s.data === dateStr);
    return { dayNum, dateStr, shifts: dayShifts };
  });

  // Calculate totals
  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const handleExportPersonalPDF = () => {
    const monthLabel = `${monthNames[currentMonth]} ${currentYear}`;
    exportPersonalShiftPDF(
      employee?.nome || user?.email?.split('@')[0] || 'Dipendente',
      shifts,
      monthLabel,
      currentYear,
      currentMonth
    );
  };

  const totalPranzi = shifts.filter((s) => s.turno === 'pranzo').length;
  const totalCene = shifts.filter((s) => s.turno === 'cena').length;
  const uniqueDatesCount = new Set(shifts.map((s) => s.data)).size;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 16px 40px' }}>
      
      {/* PWA Banner */}
      <PwaInstallPrompt />

      {/* Month Picker & Personal Export Button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        <MonthPicker
          currentYear={currentYear}
          currentMonth={currentMonth}
          onChange={handleMonthChange}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
          <button
            onClick={handleExportPersonalPDF}
            className="btn-primary"
            style={{ padding: '10px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
          >
            <FileText size={16} />
            Scarica il Mio Resoconto (PDF)
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="glass-card stat-card">
          <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '10px', borderRadius: '10px' }}>
            <Sun size={20} color="#fbbf24" />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Turni Pranzo</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{totalPranzi}</h3>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '10px', borderRadius: '10px' }}>
            <Moon size={20} color="#a5b4fc" />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Turni Cena</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{totalCene}</h3>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '10px', borderRadius: '10px' }}>
            <Clock size={20} color="#38bdf8" />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Totale Turni</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{totalPranzi + totalCene}</h3>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div style={{ background: 'rgba(34, 197, 94, 0.15)', padding: '10px', borderRadius: '10px' }}>
            <CheckCircle2 size={20} color="#4ade80" />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Giorni Lavorati</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{uniqueDatesCount}</h3>
          </div>
        </div>
      </div>

      {/* Instructional Banner */}
      <div className="glass-card" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(30, 41, 59, 0.4)' }}>
        <Info size={18} color="#38bdf8" />
        <p style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
          Tocca qualsiasi giorno per aggiungere o modificare i turni svolti (Pranzo / Cena).
        </p>
      </div>

      {/* Days Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          Caricamento turni in corso...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
          {daysArray.map(({ dayNum, dateStr, shifts: dayShifts }) => {
            const dayDate = new Date(currentYear, currentMonth, dayNum);
            const isToday =
              today.getDate() === dayNum &&
              today.getMonth() === currentMonth &&
              today.getFullYear() === currentYear;

            const dayName = dayDate.toLocaleDateString('it-IT', { weekday: 'short' });
            const hasPranzo = dayShifts.some((s) => s.turno === 'pranzo');
            const hasCena = dayShifts.some((s) => s.turno === 'cena');

            return (
              <div
                key={dateStr}
                onClick={() => handleOpenDay(dateStr)}
                className="glass-card"
                style={{
                  padding: '12px',
                  minHeight: '100px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: isToday ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                  background: (hasPranzo || hasCena) ? 'rgba(30, 41, 59, 0.85)' : 'rgba(15, 23, 42, 0.4)',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: isToday ? '#38bdf8' : '#f8fafc' }}>
                    {dayNum}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'capitalize' }}>
                    {dayName}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                  {hasPranzo && (
                    <span className="badge-pranzo">
                      ☀️ Pranzo
                    </span>
                  )}
                  {hasCena && (
                    <span className="badge-cena">
                      🌙 Cena
                    </span>
                  )}
                  {!hasPranzo && !hasCena && (
                    <span style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '4px' }}>
                      <Plus size={12} /> Aggiungi
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <ShiftModal
        isOpen={isModalOpen}
        date={selectedDate}
        existingShifts={shifts.filter((s) => s.data === selectedDate)}
        onSave={handleSaveShift}
        onDelete={handleDeleteShift}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
