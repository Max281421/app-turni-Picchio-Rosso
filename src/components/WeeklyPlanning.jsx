import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { sharePlanningToWhatsApp } from '../lib/whatsappExport';
import { Calendar, Sun, Moon, Send, CheckCircle2, ChevronLeft, ChevronRight, UserCheck, Clock } from 'lucide-react';

// Helper per ottenere il Lunedì della settimana a partire da una data qualsiasi
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
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

export default function WeeklyPlanning({ mode = 'planning', employeesList: propEmployeesList, refreshMasterShifts }) {
  const { currentEmployee, employee, isAdmin } = useAuth();
  const activeEmployee = currentEmployee || employee;
  const isPersonalMode = mode === 'availabilities';
  const [employeesList, setEmployeesList] = useState(propEmployeesList || []);
  
  // Data del Lunedì della settimana selezionata
  const [currentMonday, setCurrentMonday] = useState(() => {
    const today = new Date();
    const monday = getMonday(today);
    // Se è venerdì, sabato o domenica, imposta di default la settimana successiva per le disponibilità
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

  // Calcola le date della settimana corrente (Martedì escluso per chiusura)
  const fullWeekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() + i);
    return {
      date: d,
      dateStr: formatDateLocal(d),
      dayName: DAY_NAMES[i],
      dayFormatted: d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
      isSunday: d.getDay() === 0,
      isTuesday: d.getDay() === 2,
    };
  });

  const weekDays = fullWeekDays.filter(day => !day.isTuesday);

  const weekStartStr = weekDays[0].dateStr;
  const weekEndStr = weekDays[weekDays.length - 1].dateStr;

  useEffect(() => {
    fetchWeekData();
  }, [currentMonday, mode]);

  const fetchWeekData = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setLoading(true);
    setMessage(null);
    try {
      // 0. Carica sempre l'elenco completo dipendenti dal DB
      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .select('*')
        .order('nome');

      if (empErr) {
        console.error('Errore caricamento dipendenti:', empErr);
      }

      let list = empData || [];
      
      // Auto-healing: se l'utente attivo non ha ancora un record salvato nella tabella employees di Supabase, crealo subito
      if (activeEmployee && (!list || !list.some(e => e.auth_user_id === activeEmployee.auth_user_id || e.id === activeEmployee.id))) {
        const authId = activeEmployee.auth_user_id || activeEmployee.id;
        const { data: insertedEmp } = await supabase
          .from('employees')
          .insert([{ auth_user_id: authId, nome: activeEmployee.nome || 'Admin', ruolo: activeEmployee.ruolo || 'admin' }])
          .select()
          .maybeSingle();

        if (insertedEmp) {
          list = [insertedEmp, ...list.filter(e => e.id !== insertedEmp.id)];
        } else {
          list = [activeEmployee, ...list];
        }
      }

      setEmployeesList(list);

      // 1. Carica disponibilità per l'intervallo di date
      const { data: availData, error: availErr } = await supabase
        .from('availabilities')
        .select('*')
        .gte('data', weekStartStr)
        .lte('data', weekEndStr);

      if (availErr) {
        console.error('Errore caricamento disponibilità:', availErr);
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
      const { data: shiftsData, error: shiftsErr } = await supabase
        .from('shifts')
        .select('*')
        .gte('data', weekStartStr)
        .lte('data', weekEndStr);

      if (shiftsErr) {
        console.error('Errore caricamento turni:', shiftsErr);
      }

      const sMap = {};
      if (shiftsData) {
        shiftsData.forEach(item => {
          sMap[`${item.employee_id}_${item.data}_${item.turno}`] = item.id;
        });
      }
      setAssignedShiftsMap(sMap);
    } catch (err) {
      console.error('Errore caricamento dati settimana:', err);
    } finally {
      setLoading(false);
    }
  };

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

  // Toggle Disponibilità (Lato Dipendente)
  const toggleAvailability = async (empId, dateStr, turno) => {
    const supabase = getSupabaseClient();
    if (!supabase || !empId) return;
    const key = `${empId}_${dateStr}_${turno}`;
    const currentValue = !!availabilitiesMap[key];
    const newValue = !currentValue;

    setAvailabilitiesMap(prev => ({
      ...prev,
      [key]: newValue,
    }));

    try {
      if (newValue) {
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
        await supabase
          .from('availabilities')
          .delete()
          .match({ employee_id: empId, data: dateStr, turno: turno });
      }
    } catch (err) {
      console.error('Errore salvataggio disponibilità:', err);
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
      const { data: existingShifts, error: fetchErr } = await supabase
        .from('shifts')
        .select('*')
        .gte('data', weekStartStr)
        .lte('data', weekEndStr);

      if (fetchErr) throw fetchErr;

      const existingMap = new Map(existingShifts.map(s => [`${s.employee_id}_${s.data}_${s.turno}`, s.id]));

      const toInsert = [];
      const toDeleteIds = [];

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

      if (toDeleteIds.length > 0) {
        const { error: delErr } = await supabase.from('shifts').delete().in('id', toDeleteIds);
        if (delErr) throw delErr;
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('shifts').insert(toInsert);
        if (insErr) throw insErr;
      }

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

  // Condivisione WhatsApp
  const handleWhatsAppShare = () => {
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
    <div className="glass-card" style={{ padding: '24px', marginBottom: '32px' }}>
      
      {/* Header Settimana e Titolo */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc' }}>
            <Calendar size={24} color="#38bdf8" />
            {isPersonalMode ? 'Le Mie Disponibilità' : 'Planning Settimanale'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
            {isPersonalMode
              ? 'Imposta le tue disponibilità per la settimana (Pranzo e Cena)'
              : 'Visualizza disponibilità ed assegna i turni per la settimana'}
          </p>
        </div>

        {/* Controlli Settimana */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', padding: '6px 12px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <button
            onClick={handlePrevWeek}
            className="btn-secondary"
            style={{ padding: '6px 10px' }}
            title="Settimana precedente"
          >
            <ChevronLeft size={16} />
          </button>
          
          <button
            onClick={handleTodayWeek}
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              cursor: 'pointer'
            }}
          >
            Oggi
          </button>

          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', padding: '0 8px', minWidth: '130px', textAlign: 'center' }}>
            {weekDays[0].dayFormatted} - {weekDays[weekDays.length - 1].dayFormatted}
          </span>

          <button
            onClick={handleNextWeek}
            className="btn-secondary"
            style={{ padding: '6px 10px' }}
            title="Settimana successiva"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Messaggio esito azioni */}
      {message && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '20px',
          borderRadius: '12px',
          fontSize: '0.9rem',
          fontWeight: 600,
          background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: message.type === 'success' ? '#34d399' : '#f87171',
          border: message.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
        }}>
          {message.text}
        </div>
      )}

      {/* Action Bar Admin (Solo in modalità Planning Settimanale) */}
      {!isPersonalMode && isAdmin && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 18px',
          marginBottom: '24px',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>
            ⚡ Spunta i turni e condividi il planning finale col gruppo
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleWhatsAppShare}
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontSize: '0.85rem', padding: '10px 16px' }}
            >
              <Send size={16} />
              Condividi su WhatsApp
            </button>

            <button
              onClick={handlePublishPlanning}
              disabled={saving}
              className="btn-primary"
              style={{ fontSize: '0.85rem', padding: '10px 16px', opacity: saving ? 0.6 : 1 }}
            >
              <CheckCircle2 size={16} />
              {saving ? 'Salvataggio...' : 'Pubblica Planning'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '0.9rem' }}>
          Caricamento disponibilità in corso...
        </div>
      ) : (
        /* GRIGLIA IBRIDA DELLE 7 GIORNATE (LUN - DOM) */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px'
        }}>
          {weekDays.map(day => (
            <div key={day.dateStr} style={{
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '14px',
              padding: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}>
              {/* Day Header */}
              <div style={{ textAlign: 'center', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: '#38bdf8', letterSpacing: '0.5px', display: 'block' }}>
                  {day.dayName}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                  {day.dayFormatted}
                </span>
              </div>

              {/* LATO DIPENDENTE / PERSONALE: Pulsanti Disponibilità Pranzo/Cena */}
              {isPersonalMode && activeEmployee && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center', textTransform: 'uppercase', fontWeight: 700 }}>
                    La tua disponibilità:
                  </span>

                  {/* Tasto Pranzo (Solo da Lunedì a Sabato) */}
                  {!day.isSunday && (
                    <button
                      type="button"
                      onClick={() => toggleAvailability(activeEmployee.id, day.dateStr, 'pranzo')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: availabilitiesMap[`${activeEmployee.id}_${day.dateStr}_pranzo`]
                          ? '1px solid rgba(245, 158, 11, 0.5)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        background: availabilitiesMap[`${activeEmployee.id}_${day.dateStr}_pranzo`]
                          ? 'rgba(245, 158, 11, 0.2)'
                          : 'rgba(30, 41, 59, 0.6)',
                        color: availabilitiesMap[`${activeEmployee.id}_${day.dateStr}_pranzo`]
                          ? '#fbbf24'
                          : '#94a3b8',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'space-between',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Sun size={13} color={availabilitiesMap[`${activeEmployee.id}_${day.dateStr}_pranzo`] ? '#fbbf24' : '#94a3b8'} />
                        Pranzo
                      </span>
                      <span>{availabilitiesMap[`${activeEmployee.id}_${day.dateStr}_pranzo`] ? '✅' : '❌'}</span>
                    </button>
                  )}

                  {/* Tasto Cena */}
                  <button
                    type="button"
                    onClick={() => toggleAvailability(activeEmployee.id, day.dateStr, 'cena')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: availabilitiesMap[`${activeEmployee.id}_${day.dateStr}_cena`]
                        ? '1px solid rgba(99, 102, 241, 0.5)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      background: availabilitiesMap[`${activeEmployee.id}_${day.dateStr}_cena`]
                        ? 'rgba(99, 102, 241, 0.2)'
                        : 'rgba(30, 41, 59, 0.6)',
                      color: availabilitiesMap[`${activeEmployee.id}_${day.dateStr}_cena`]
                        ? '#a5b4fc'
                        : '#94a3b8',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Moon size={13} color={availabilitiesMap[`${activeEmployee.id}_${day.dateStr}_cena`] ? '#a5b4fc' : '#94a3b8'} />
                      Cena
                    </span>
                    <span>{availabilitiesMap[`${activeEmployee.id}_${day.dateStr}_cena`] ? '✅' : '❌'}</span>
                  </button>
                </div>
              )}

              {/* LATO ADMIN: Selettore Dipendenti per Pranzo e Cena */}
              {!isPersonalMode && isAdmin && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {['pranzo', 'cena'].filter(t => !(day.isSunday && t === 'pranzo')).map(turno => (
                    <div key={turno} style={{
                      background: 'rgba(30, 41, 59, 0.5)',
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: turno === 'pranzo' ? '#fbbf24' : '#a5b4fc', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                        {turno === 'pranzo' ? <Sun size={12} /> : <Moon size={12} />}
                        <span style={{ textTransform: 'capitalize' }}>{turno}</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {employeesList.map(emp => {
                          const isAvail = !!availabilitiesMap[`${emp.id}_${day.dateStr}_${turno}`];
                          const isAssigned = !!assignedShiftsMap[`${emp.id}_${day.dateStr}_${turno}`];

                          return (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => toggleShiftAssignment(emp.id, day.dateStr, turno)}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: isAssigned ? 700 : 500,
                                border: isAssigned
                                  ? '1px solid rgba(16, 185, 129, 0.8)'
                                  : '1px solid transparent',
                                background: isAssigned
                                  ? 'rgba(16, 185, 129, 0.25)'
                                  : isAvail
                                  ? 'rgba(51, 65, 85, 0.7)'
                                  : 'rgba(15, 23, 42, 0.4)',
                                color: isAssigned
                                  ? '#34d399'
                                  : isAvail
                                  ? '#f8fafc'
                                  : '#64748b',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.15s'
                              }}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {emp.nome}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isAvail && (
                                  <span
                                    style={{
                                      width: '6px',
                                      height: '6px',
                                      borderRadius: '50%',
                                      background: '#34d399',
                                      display: 'inline-block'
                                    }}
                                    title="Disponibile"
                                  />
                                )}
                                {isAssigned && <span>✓</span>}
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
