import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { sharePlanningToWhatsApp } from '../lib/whatsappExport';

// Helper per ottenere il Lunedì della settimana a partire da una data qualsiasi
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // se Domenica (0), sottrai 6 per andare al lunedì precedente
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Format YYYY-MM-DD locale
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

export default function WeeklyPlanning({ employeesList: propEmployeesList, refreshMasterShifts }) {
  const { currentEmployee, isAdmin } = useAuth();
  const [employeesList, setEmployeesList] = useState(propEmployeesList || []);
  
  // Data del Lunedì della settimana selezionata (default: prossima settimana se è fine settimana, altrimenti settimana corrente)
  const [currentMonday, setCurrentMonday] = useState(() => {
    const today = new Date();
    const monday = getMonday(today);
    // Se è venerdì, sabato o domenica, imposta di default la settimana successiva per l'inserimento disponibilità
    if (today.getDay() === 5 || today.getDay() === 6 || today.getDay() === 0) {
      monday.setDate(monday.getDate() + 7);
    }
    return monday;
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Mappa delle disponibilità: key `${employee_id}_${dateStr}_${turno}` -> boolean
  const [availabilitiesMap, setAvailabilitiesMap] = useState({});

  // Mappa dei turni pianificati/assegnati: key `${employee_id}_${dateStr}_${turno}` -> boolean
  const [assignedShiftsMap, setAssignedShiftsMap] = useState({});

  // Calcola le 7 date della settimana corrente (da Lun a Dom)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() + i);
    return {
      date: d,
      dateStr: formatDateLocal(d),
      dayName: DAY_NAMES[i],
      dayFormatted: d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
    };
  });

  const weekStartStr = weekDays[0].dateStr;
  const weekEndStr = weekDays[6].dateStr;

  // Caricamento dati per la settimana selezionata
  useEffect(() => {
    fetchWeekData();
  }, [currentMonday]);

  const fetchWeekData = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setLoading(true);
    setMessage(null);
    try {
      // 0. Carica elenco dipendenti se non fornito via prop
      let activeEmployees = propEmployeesList;
      if (!activeEmployees || activeEmployees.length === 0) {
        const { data: empData } = await supabase
          .from('employees')
          .select('*')
          .order('nome');
        if (empData) {
          activeEmployees = empData;
          setEmployeesList(empData);
        }
      }
      // 1. Carica disponibilità
      const { data: availData, error: availError } = await supabase
        .from('availabilities')
        .select('*')
        .gte('data', weekStartStr)
        .lte('data', weekEndStr);

      if (availError && availError.code !== 'PGRST116') {
        console.error('Errore caricamento disponibilità:', availError);
      }

      const aMap = {};
      if (availData) {
        availData.forEach(item => {
          if (item.is_available) {
            aMap[`${item.employee_id}_${item.data}_${item.turno}`] = true;
          }
        });
      }
      setAvailabilitiesMap(aMap);

      // 2. Carica turni assegnati (dalla tabella shifts)
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('*')
        .gte('data', weekStartStr)
        .lte('data', weekEndStr);

      if (shiftsError) {
        console.error('Errore caricamento turni:', shiftsError);
      }

      const sMap = {};
      if (shiftsData) {
        shiftsData.forEach(item => {
          sMap[`${item.employee_id}_${item.data}_${item.turno}`] = item.id;
        });
      }
      setAssignedShiftsMap(sMap);
    } catch (err) {
      console.error('Errore generale:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cambio Settimana
  const handlePrevWeek = () => {
    const newM = new Date(currentMonday);
    newM.setDate(newM.getDate() - 7);
    setCurrentMonday(newM);
  };

  const handleNextWeek = () => {
    const newM = new Date(currentMonday);
    newM.setDate(newM.getDate() + 7);
    setCurrentMonday(newM);
  };

  const handleTodayWeek = () => {
    setCurrentMonday(getMonday(new Date()));
  };

  // Toggle Disponibilità (Lato Dipendente o Admin)
  const toggleAvailability = async (empId, dateStr, turno) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const key = `${empId}_${dateStr}_${turno}`;
    const currentValue = !!availabilitiesMap[key];
    const newValue = !currentValue;

    // Aggiornamento ottimistico locale UI
    setAvailabilitiesMap(prev => ({
      ...prev,
      [key]: newValue,
    }));

    try {
      if (newValue) {
        // Upsert disponibilità
        await supabase.from('availabilities').upsert(
          {
            employee_id: empId,
            data: dateStr,
            turno: turno,
            is_available: true,
          },
          { onConflict: 'employee_id,data,turno' }
        );
      } else {
        // Elimina disponibilità se deselezionata
        await supabase
          .from('availabilities')
          .delete()
          .match({ employee_id: empId, data: dateStr, turno: turno });
      }
    } catch (err) {
      console.error('Errore salvataggio disponibilità:', err);
      // Revert in caso di errore
      setAvailabilitiesMap(prev => ({
        ...prev,
        [key]: currentValue,
      }));
    }
  };

  // Toggle Assegnazione Turno (Lato Admin)
  const toggleShiftAssignment = (empId, dateStr, turno) => {
    const key = `${empId}_${dateStr}_${turno}`;
    setAssignedShiftsMap(prev => {
      const copy = { ...prev };
      if (copy[key]) {
        delete copy[key];
      } else {
        copy[key] = true;
      }
      return copy;
    });
  };

  // Salva e Pubblica Planning Ufficiale (Lato Admin)
  const handlePublishPlanning = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setSaving(true);
    setMessage(null);
    try {
      // 1. Recupera i turni attualmente presenti a database per la settimana
      const { data: existingShifts, error: fetchErr } = await supabase
        .from('shifts')
        .select('*')
        .gte('data', weekStartStr)
        .lte('data', weekEndStr);

      if (fetchErr) throw fetchErr;

      const existingMap = new Map(existingShifts.map(s => [`${s.employee_id}_${s.data}_${s.turno}`, s.id]));

      const toInsert = [];
      const toDeleteIds = [];

      // Determina quali turni aggiungere e quali rimuovere
      for (const day of weekDays) {
        for (const emp of employeesList) {
          for (const turno of ['pranzo', 'cena']) {
            const key = `${emp.id}_${day.dateStr}_${turno}`;
            const isAssigned = !!assignedShiftsMap[key];
            const existingId = existingMap.get(key);

            if (isAssigned && !existingId) {
              toInsert.push({
                employee_id: emp.id,
                data: day.dateStr,
                turno: turno,
              });
            } else if (!isAssigned && existingId) {
              toDeleteIds.push(existingId);
            }
          }
        }
      }

      // Esegui cancellazioni
      if (toDeleteIds.length > 0) {
        const { error: delErr } = await supabase.from('shifts').delete().in('id', toDeleteIds);
        if (delErr) throw delErr;
      }

      // Esegui inserimenti
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('shifts').insert(toInsert);
        if (insErr) throw insErr;
      }

      // Salva un flag di notifica ultimo planning in localStorage
      localStorage.setItem(`last_published_planning_${weekStartStr}`, new Date().toISOString());

      setMessage({ type: 'success', text: '✅ Planning pubblicato con successo su database e turni ufficiali!' });
      if (refreshMasterShifts) refreshMasterShifts();
      fetchWeekData();
    } catch (err) {
      console.error('Errore pubblicazione planning:', err);
      setMessage({ type: 'error', text: '❌ Errore durante la pubblicazione del planning.' });
    } finally {
      setSaving(false);
    }
  };

  // Gestione Condivisione WhatsApp
  const handleWhatsAppShare = () => {
    // Prepara la struttura dati per il formatter WhatsApp
    const weekDaysArray = weekDays.map(day => {
      const assignedShifts = [];
      for (const emp of employeesList) {
        for (const turno of ['pranzo', 'cena']) {
          const key = `${emp.id}_${day.dateStr}_${turno}`;
          if (assignedShiftsMap[key]) {
            assignedShifts.push({ employee_id: emp.id, turno });
          }
        }
      }
      return {
        date: day.date,
        dateStr: day.dateStr,
        assignedShifts,
      };
    });

    sharePlanningToWhatsApp(weekDaysArray, employeesList);
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 sm:p-6 border border-slate-800 shadow-xl mb-8">
      {/* Controlli Navigazione Settimana */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <span>📋</span> Planning & Disponibilità
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            {isAdmin ? 'Visualizza disponibilità ed assegna i turni della settimana' : 'Imposta le tue disponibilità per la settimana'}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shadow-inner">
          <button
            onClick={handlePrevWeek}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            title="Settimana precedente"
          >
            ◀
          </button>
          <button
            onClick={handleTodayWeek}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 border border-indigo-500/30 transition-colors"
          >
            Oggi
          </button>
          <span className="text-xs sm:text-sm font-semibold text-slate-200 px-2 min-w-[140px] text-center">
            {weekDays[0].dayFormatted} - {weekDays[6].dayFormatted}
          </span>
          <button
            onClick={handleNextWeek}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            title="Settimana successiva"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Messaggio esito azioni */}
      {message && (
        <div className={`p-3.5 mb-6 rounded-xl text-sm font-medium border ${message.type === 'success' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' : 'bg-rose-950/60 text-rose-300 border-rose-800/60'}`}>
          {message.text}
        </div>
      )}

      {/* Controlli Azioni Admin Top Bar */}
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 mb-6 bg-slate-950/60 rounded-xl border border-slate-800">
          <span className="text-xs font-medium text-slate-400">
            Azione Titolare: spunta i turni e pubblica al gruppo
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={handleWhatsAppShare}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg transition-all active:scale-95"
            >
              <span>📲</span> Condividi su WhatsApp
            </button>

            <button
              onClick={handlePublishPlanning}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              <span>💾</span> {saving ? 'Salvataggio...' : 'Pubblica Planning'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-400">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Caricamento disponibilità...
        </div>
      ) : (
        /* GRIGLIA SETTIMANALE */
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map(day => (
            <div key={day.dateStr} className="bg-slate-950/50 rounded-xl p-3 border border-slate-800/80 flex flex-col justify-between">
              {/* Header Giorno */}
              <div className="text-center pb-2 mb-2 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 block">
                  {day.dayName}
                </span>
                <span className="text-xs text-slate-400 font-medium">{day.dayFormatted}</span>
              </div>

              {/* Sezione per Dipendente: Imposta la propria disponibilità */}
              {!isAdmin && currentEmployee && (
                <div className="space-y-2 my-auto">
                  <p className="text-[10px] text-slate-500 text-center font-medium uppercase">La tua disponibilità:</p>
                  
                  {/* Tasto Pranzo */}
                  <button
                    onClick={() => toggleAvailability(currentEmployee.id, day.dateStr, 'pranzo')}
                    className={`w-full py-2 px-2 text-xs font-semibold rounded-lg border flex items-center justify-between transition-all ${
                      availabilitiesMap[`${currentEmployee.id}_${day.dateStr}_pranzo`]
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <span>☀️ Pranzo</span>
                    <span>{availabilitiesMap[`${currentEmployee.id}_${day.dateStr}_pranzo`] ? '✅' : '❌'}</span>
                  </button>

                  {/* Tasto Cena */}
                  <button
                    onClick={() => toggleAvailability(currentEmployee.id, day.dateStr, 'cena')}
                    className={`w-full py-2 px-2 text-xs font-semibold rounded-lg border flex items-center justify-between transition-all ${
                      availabilitiesMap[`${currentEmployee.id}_${day.dateStr}_cena`]
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-sm'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <span>🌙 Cena</span>
                    <span>{availabilitiesMap[`${currentEmployee.id}_${day.dateStr}_cena`] ? '✅' : '❌'}</span>
                  </button>
                </div>
              )}

              {/* Sezione per Admin: Assegna Turni ai Dipendenti Disponibili */}
              {isAdmin && (
                <div className="space-y-3">
                  {['pranzo', 'cena'].map(turno => (
                    <div key={turno} className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between mb-1.5">
                        <span>{turno === 'pranzo' ? '☀️ Pranzo' : '🌙 Cena'}</span>
                      </div>

                      <div className="space-y-1.5">
                        {employeesList.map(emp => {
                          const isAvail = !!availabilitiesMap[`${emp.id}_${day.dateStr}_${turno}`];
                          const isAssigned = !!assignedShiftsMap[`${emp.id}_${day.dateStr}_${turno}`];

                          return (
                            <button
                              key={emp.id}
                              onClick={() => toggleShiftAssignment(emp.id, day.dateStr, turno)}
                              className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between border transition-all ${
                                isAssigned
                                  ? 'bg-emerald-950/80 text-emerald-200 border-emerald-600/80 font-bold shadow'
                                  : isAvail
                                  ? 'bg-slate-800/90 text-slate-200 border-slate-700 hover:border-emerald-600/50'
                                  : 'bg-slate-950/40 text-slate-500 border-transparent hover:bg-slate-800/50'
                              }`}
                            >
                              <span className="truncate">{emp.nome}</span>
                              <div className="flex items-center gap-1">
                                {isAvail && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm" title="Disponibile"></span>}
                                <span className="text-[10px]">{isAssigned ? '✓' : ''}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
