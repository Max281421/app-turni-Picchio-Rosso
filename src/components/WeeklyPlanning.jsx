import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { sharePlanningToWhatsApp } from '../lib/whatsappExport';
import { Calendar, Sun, Moon, Send, CheckCircle2, ChevronLeft, ChevronRight, UserCheck } from 'lucide-react';
import confetti from 'canvas-confetti';

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
  const { currentEmployee, employee, isAdmin: contextIsAdmin } = useAuth();
  const activeEmployee = currentEmployee || employee;
  const isAdmin = contextIsAdmin !== undefined ? contextIsAdmin : (activeEmployee?.ruolo === 'admin');
  const isPersonalMode = mode === 'availabilities';
  const [employeesList, setEmployeesList] = useState(propEmployeesList || []);
  
  // Data del Lunedì della settimana selezionata
  const [currentMonday, setCurrentMonday] = useState(() => {
    const today = new Date();
    const monday = getMonday(today);
    // Se è venerdì, sabato o domenica, imposta di default la settimana successiva per le disponibilità personali
    if (mode === 'availabilities' && (today.getDay() === 5 || today.getDay() === 6 || today.getDay() === 0)) {
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

  // Calcola le 7 date della settimana corrente (incluso Martedì)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
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

  const weekStartStr = weekDays[0].dateStr;
  const weekEndStr = weekDays[6].dateStr;

  useEffect(() => {
    fetchWeekData();
  }, [currentMonday, mode]);

  const isAvailable = (empOrId, dateStr, turno) => {
    if (!empOrId) return false;
    if (typeof empOrId === 'object') {
      return !!(
        (empOrId.id && availabilitiesMap[`${empOrId.id}_${dateStr}_${turno}`]) ||
        (empOrId.auth_user_id && availabilitiesMap[`${empOrId.auth_user_id}_${dateStr}_${turno}`])
      );
    }
    return !!availabilitiesMap[`${empOrId}_${dateStr}_${turno}`];
  };

  const isAssigned = (empOrId, dateStr, turno) => {
    if (!empOrId) return false;
    if (typeof empOrId === 'object') {
      return !!(
        (empOrId.id && assignedShiftsMap[`${empOrId.id}_${dateStr}_${turno}`]) ||
        (empOrId.auth_user_id && assignedShiftsMap[`${empOrId.auth_user_id}_${dateStr}_${turno}`])
      );
    }
    return !!assignedShiftsMap[`${empOrId}_${dateStr}_${turno}`];
  };

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

      // Map di supporto per associare id ed auth_user_id di ogni dipendente
      const empIdToAuthId = new Map(list.map(e => [e.id, e.auth_user_id]));
      const authIdToEmpId = new Map(list.map(e => [e.auth_user_id, e.id]));

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
            const altId1 = empIdToAuthId.get(item.employee_id);
            if (altId1) aMap[`${altId1}_${item.data}_${item.turno}`] = true;
            const altId2 = authIdToEmpId.get(item.employee_id);
            if (altId2) aMap[`${altId2}_${item.data}_${item.turno}`] = true;
          }
        });
      }
      setAvailabilitiesMap(aMap);

      // 2. Carica turni pianificati dalla nuova tabella planned_shifts
      let { data: plannedData, error: plannedErr } = await supabase
        .from('planned_shifts')
        .select('*')
        .gte('data', weekStartStr)
        .lte('data', weekEndStr);

      if (plannedErr) {
        console.error('planned_shifts fetch error:', plannedErr);
        if (plannedErr.code === 'PGRST205') {
          setMessage({
            type: 'error',
            text: '⚠️ Tabella "planned_shifts" assente sul database Supabase Beta. Esegui il file SQL schema_planned_shifts.sql nell\'SQL Editor della Dashboard Supabase.'
          });
        }
      }

      const sMap = {};
      if (plannedData) {
        plannedData.forEach(item => {
          sMap[`${item.employee_id}_${item.data}_${item.turno}`] = item.id;
          const altId1 = empIdToAuthId.get(item.employee_id);
          if (altId1) sMap[`${altId1}_${item.data}_${item.turno}`] = item.id;
          const altId2 = authIdToEmpId.get(item.employee_id);
          if (altId2) sMap[`${altId2}_${item.data}_${item.turno}`] = item.id;
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

    let targetEmpId = empId;
    let authId = activeEmployee?.auth_user_id || activeEmployee?.id || empId;

    // Cerca l'employee record reale in Supabase
    const { data: empRecord } = await supabase
      .from('employees')
      .select('id, auth_user_id')
      .or(`id.eq.${empId},auth_user_id.eq.${authId}`)
      .maybeSingle();

    if (empRecord?.id) {
      targetEmpId = empRecord.id;
      authId = empRecord.auth_user_id || authId;
    } else if (activeEmployee) {
      const { data: createdEmp } = await supabase
        .from('employees')
        .insert([{ auth_user_id: authId, nome: activeEmployee.nome || 'Utente', ruolo: activeEmployee.ruolo || 'dipendente' }])
        .select('id, auth_user_id')
        .maybeSingle();

      if (createdEmp?.id) {
        targetEmpId = createdEmp.id;
        authId = createdEmp.auth_user_id || authId;
      }
    }

    const key1 = `${targetEmpId}_${dateStr}_${turno}`;
    const key2 = `${authId}_${dateStr}_${turno}`;
    const key3 = `${empId}_${dateStr}_${turno}`;

    const currentValue = isAvailable(activeEmployee, dateStr, turno);
    const newValue = !currentValue;

    // Aggiorna lo stato locale per TUTTE le chiavi possibili
    setAvailabilitiesMap(prev => ({
      ...prev,
      [key1]: newValue,
      [key2]: newValue,
      [key3]: newValue,
    }));

    try {
      if (newValue) {
        await supabase.from('availabilities').upsert(
          {
            employee_id: targetEmpId,
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
          .match({ employee_id: targetEmpId, data: dateStr, turno: turno });
      }
    } catch (err) {
      console.error('Errore salvataggio disponibilità:', err);
    }
  };

  // Toggle Assegnazione Turno (Lato Admin)
  const toggleShiftAssignment = (emp, dateStr, turno) => {
    const empId = emp.id;
    const authId = emp.auth_user_id;

    const key1 = `${empId}_${dateStr}_${turno}`;
    const key2 = authId ? `${authId}_${dateStr}_${turno}` : null;

    const currentValue = isAssigned(emp, dateStr, turno);
    const newValue = !currentValue;

    setAssignedShiftsMap(prev => {
      const copy = { ...prev };
      if (newValue) {
        copy[key1] = true;
        if (key2) copy[key2] = true;
      } else {
        delete copy[key1];
        if (key2) delete copy[key2];
      }
      return copy;
    });
  };

  // Salva e Pubblica Planning Ufficiale (Salva ESCLUSIVAMENTE nella tabella planned_shifts, SENZA toccare la tabella shifts dei turni lavorati)
  const handlePublishPlanning = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setSaving(true);
    setMessage(null);
    try {
      const { data: dbEmployees } = await supabase.from('employees').select('id, auth_user_id');
      const empIdMap = new Map();
      dbEmployees?.forEach(e => {
        if (e.id) empIdMap.set(e.id, e.id);
        if (e.auth_user_id) empIdMap.set(e.auth_user_id, e.id);
      });

      const { data: existingShifts, error: fetchErr } = await supabase
        .from('planned_shifts')
        .select('*')
        .gte('data', weekStartStr)
        .lte('data', weekEndStr);

      if (fetchErr) {
        if (fetchErr.code === 'PGRST205') {
          throw new Error('Tabella "planned_shifts" assente sul database. Esegui il file SQL schema_planned_shifts.sql nella dashboard Supabase -> SQL Editor.');
        }
        throw fetchErr;
      }

      const existingMap = new Map();
      existingShifts?.forEach(s => {
        existingMap.set(`${s.employee_id}_${s.data}_${s.turno}`, s.id);
      });

      const rawInsert = [];
      const toDeleteIds = [];

      for (const day of weekDays) {
        if (day.isTuesday) continue;
        for (const emp of employeesList) {
          const targetEmpDbId = empIdMap.get(emp.id) || empIdMap.get(emp.auth_user_id) || emp.id;

          for (const turno of ['pranzo', 'cena']) {
            if (day.isSunday && turno === 'pranzo') continue;

            const isAssignedShift = isAssigned(emp, day.dateStr, turno);
            const existingId = existingMap.get(`${targetEmpDbId}_${day.dateStr}_${turno}`) ||
                               existingMap.get(`${emp.id}_${day.dateStr}_${turno}`) ||
                               (emp.auth_user_id ? existingMap.get(`${emp.auth_user_id}_${day.dateStr}_${turno}`) : null);

            if (isAssignedShift && !existingId) {
              rawInsert.push({
                employee_id: targetEmpDbId,
                data: day.dateStr,
                turno: turno,
              });
            } else if (!isAssignedShift && existingId) {
              toDeleteIds.push(existingId);
            }
          }
        }
      }

      // Deduplica gli inserimenti per prevenire errori di Unique Constraint
      const toInsert = [];
      const seenKeys = new Set();
      for (const item of rawInsert) {
        const key = `${item.employee_id}_${item.data}_${item.turno}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          toInsert.push(item);
        }
      }

      const uniqueDeleteIds = Array.from(new Set(toDeleteIds));

      if (uniqueDeleteIds.length > 0) {
        const { error: delErr } = await supabase.from('planned_shifts').delete().in('id', uniqueDeleteIds);
        if (delErr) {
          if (delErr.code === '42501') {
            throw new Error('Permessi insufficienti su planned_shifts (Errore 42501). Esegui il file SQL schema_planned_shifts.sql aggiornato su Supabase per concedere le GRANT.');
          }
          throw delErr;
        }
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('planned_shifts').insert(toInsert);
        if (insErr) {
          if (insErr.code === '42501') {
            throw new Error('Permessi insufficienti su planned_shifts (Errore 42501). Esegui il file SQL schema_planned_shifts.sql aggiornato su Supabase per concedere le GRANT.');
          }
          throw insErr;
        }
      }

      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.7 }
        });
      } catch (e) {}

      setMessage({ type: 'success', text: `🎉 Planning pubblicato con successo! I turni dal ${weekDays[0].dayFormatted} al ${weekDays[6].dayFormatted} sono salvati nel Planning Settimanale ed ora visibili nel box "Turni Confermati".` });
      if (refreshMasterShifts) refreshMasterShifts();
      fetchWeekData();
    } catch (err) {
      console.error('Errore pubblicazione planning:', err);
      setMessage({ type: 'error', text: '❌ Errore durante la pubblicazione del planning: ' + (err.message || 'Verifica il database.') });
    } finally {
      setSaving(false);
    }
  };

  // Condivisione WhatsApp
  const handleWhatsAppShare = () => {
    const weekDaysArray = weekDays.map(day => {
      const assignedShifts = [];
      const availableShifts = [];

      if (day.isTuesday) {
        return { date: day.date, dateStr: day.dateStr, assignedShifts: [], availableShifts: [] };
      }

      for (const emp of employeesList) {
        for (const turno of ['pranzo', 'cena']) {
          if (day.isSunday && turno === 'pranzo') continue;

          if (isAssigned(emp, day.dateStr, turno)) {
            assignedShifts.push({ employee_id: emp.id, turno });
          }
          if (isAvailable(emp, day.dateStr, turno)) {
            availableShifts.push({ employee_id: emp.id, turno });
          }
        }
      }
      return {
        date: day.date,
        dateStr: day.dateStr,
        assignedShifts,
        availableShifts,
      };
    });

    sharePlanningToWhatsApp(weekDaysArray, employeesList);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
      
      {/* BOX 1: INSERIMENTO DISPONIBILITÀ (O PLANNING ADMIN COMPLETO) */}
      <div className="glass-card" style={{ padding: '24px' }}>
        
        {/* Header Settimana e Titolo */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc' }}>
              <Calendar size={24} color="#38bdf8" />
              {isPersonalMode ? 'Inserimento Disponibilità' : 'Planning Settimanale'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
              {isPersonalMode
                ? 'Imposta le tue disponibilità per la settimana (Pranzo e Cena)'
                : 'Visualizza disponibilità ed assegna i turni per la settimana'}
            </p>
          </div>

          {/* Controlli Settimana (Sincronizza entrambi i box) */}
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
              {weekDays[0].dayFormatted} - {weekDays[6].dayFormatted}
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
            Caricamento in corso...
          </div>
        ) : (
          /* GRIGLIA BOX 1 (DISPONIBILITÀ PERSONALI O PANNELLO ADMIN) */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px'
          }}>
            {weekDays.map(day => (
              <div key={day.dateStr} style={{
                background: day.isTuesday ? 'rgba(15, 23, 42, 0.35)' : 'rgba(15, 23, 42, 0.6)',
                borderRadius: '14px',
                padding: '12px',
                border: day.isTuesday ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid rgba(255, 255, 255, 0.08)',
                opacity: day.isTuesday ? 0.65 : 1,
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between'
              }}>
                {/* Day Header */}
                <div style={{ textAlign: 'center', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: day.isTuesday ? '#64748b' : '#38bdf8', letterSpacing: '0.5px', display: 'block' }}>
                    {day.dayName}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                    {day.dayFormatted}
                  </span>
                </div>

                {/* LATO DIPENDENTE / PERSONALE: Pulsanti Disponibilità */}
                {isPersonalMode && activeEmployee && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center', textTransform: 'uppercase', fontWeight: 700 }}>
                      {day.isTuesday ? 'Giorno di Chiusura' : 'La tua disponibilità:'}
                    </span>

                    {day.isTuesday ? (
                      <div style={{
                        padding: '24px 8px',
                        textAlign: 'center',
                        background: 'rgba(30, 41, 59, 0.3)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        color: '#64748b',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.5px'
                      }}>
                        🔒 CHIUSO
                      </div>
                    ) : (
                      <>
                        {/* Tasto Pranzo (Solo da Lunedì a Sabato) */}
                        {!day.isSunday ? (
                          <button
                            type="button"
                            onClick={() => toggleAvailability(activeEmployee.id, day.dateStr, 'pranzo')}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: isAvailable(activeEmployee, day.dateStr, 'pranzo')
                                ? '1px solid rgba(245, 158, 11, 0.5)'
                                : '1px solid rgba(255, 255, 255, 0.08)',
                              background: isAvailable(activeEmployee, day.dateStr, 'pranzo')
                                ? 'rgba(245, 158, 11, 0.2)'
                                : 'rgba(30, 41, 59, 0.6)',
                              color: isAvailable(activeEmployee, day.dateStr, 'pranzo')
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
                              <Sun size={13} color={isAvailable(activeEmployee, day.dateStr, 'pranzo') ? '#fbbf24' : '#94a3b8'} />
                              Pranzo
                            </span>
                            <span>{isAvailable(activeEmployee, day.dateStr, 'pranzo') ? '✅' : '❌'}</span>
                          </button>
                        ) : (
                          /* Spacer trasparente la Domenica a Pranzo per allineare orizzontalmente il pulsante Cena */
                          <div style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid transparent',
                            visibility: 'hidden',
                            userSelect: 'none'
                          }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                              <Sun size={13} />
                              Pranzo
                            </span>
                          </div>
                        )}

                        {/* Tasto Cena */}
                        <button
                          type="button"
                          onClick={() => toggleAvailability(activeEmployee.id, day.dateStr, 'cena')}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: isAvailable(activeEmployee, day.dateStr, 'cena')
                              ? '1px solid rgba(99, 102, 241, 0.5)'
                              : '1px solid rgba(255, 255, 255, 0.08)',
                            background: isAvailable(activeEmployee, day.dateStr, 'cena')
                              ? 'rgba(99, 102, 241, 0.2)'
                              : 'rgba(30, 41, 59, 0.6)',
                            color: isAvailable(activeEmployee, day.dateStr, 'cena')
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
                            <Moon size={13} color={isAvailable(activeEmployee, day.dateStr, 'cena') ? '#a5b4fc' : '#94a3b8'} />
                            Cena
                          </span>
                          <span>{isAvailable(activeEmployee, day.dateStr, 'cena') ? '✅' : '❌'}</span>
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* LATO ADMIN: Selettore Dipendenti per Pranzo e Cena */}
                {!isPersonalMode && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {day.isTuesday ? (
                      <div style={{
                        padding: '24px 8px',
                        textAlign: 'center',
                        background: 'rgba(30, 41, 59, 0.3)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        color: '#64748b',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.5px'
                      }}>
                        🔒 CHIUSO
                      </div>
                    ) : (
                      ['pranzo', 'cena'].map(turno => {
                        if (day.isSunday && turno === 'pranzo') {
                          /* Spacer la Domenica a Pranzo per allineare il box Cena con gli altri giorni */
                          return (
                            <div
                              key="pranzo-spacer-sunday"
                              style={{
                                background: 'transparent',
                                padding: '8px',
                                borderRadius: '8px',
                                border: '1px solid transparent',
                                visibility: 'hidden',
                                userSelect: 'none'
                              }}
                            >
                              <div style={{ fontSize: '0.7rem', fontWeight: 700, gap: '4px', marginBottom: '6px' }}>
                                <Sun size={12} />
                                <span>Pranzo</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {employeesList.map(emp => (
                                  <div key={emp.id} style={{ padding: '5px 8px', fontSize: '0.72rem' }}>
                                    {emp.nome}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        return (
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
                                const empAvail = isAvailable(emp, day.dateStr, turno);
                                const empAssigned = isAssigned(emp, day.dateStr, turno);

                                return (
                                  <button
                                    key={emp.id}
                                    type="button"
                                    onClick={() => isAdmin && toggleShiftAssignment(emp, day.dateStr, turno)}
                                    disabled={!isAdmin}
                                    style={{
                                      width: '100%',
                                      textAlign: 'left',
                                      padding: '5px 8px',
                                      borderRadius: '6px',
                                      fontSize: '0.72rem',
                                      fontWeight: empAssigned ? 700 : 500,
                                      border: empAssigned
                                        ? '1px solid rgba(16, 185, 129, 0.8)'
                                        : '1px solid transparent',
                                      background: empAssigned
                                        ? 'rgba(16, 185, 129, 0.25)'
                                        : empAvail
                                        ? 'rgba(51, 65, 85, 0.7)'
                                        : 'rgba(15, 23, 42, 0.4)',
                                      color: empAssigned
                                        ? '#34d399'
                                        : empAvail
                                        ? '#f8fafc'
                                        : '#64748b',
                                      cursor: isAdmin ? 'pointer' : 'default',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justify: 'space-between',
                                      transition: 'all 0.15s'
                                    }}
                                  >
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {emp.nome}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      {empAvail && (
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
                                      {empAssigned && <span>✓</span>}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOX 2: TURNI CONFERMATI (SOLO NELLA PAGINA "LE MIE DISPONIBILITÀ") */}
      {isPersonalMode && (
        <div className="glass-card" style={{ padding: '24px' }}>
          
          {/* Header Box 2 */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc' }}>
                <UserCheck size={22} color="#38bdf8" />
                Turni Confermati dall'Admin
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
                Visualizza i turni di Pranzo e Cena confermati per la settimana ({weekDays[0].dayFormatted} - {weekDays[6].dayFormatted}). Usa le frecce in alto per consultare lo storico delle settimane passate!
              </p>
            </div>
          </div>

          {/* Griglia Box 2: Turni Confermati per ogni giorno */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px'
          }}>
            {weekDays.map(day => (
              <div key={day.dateStr} style={{
                background: day.isTuesday ? 'rgba(15, 23, 42, 0.35)' : 'rgba(15, 23, 42, 0.6)',
                borderRadius: '14px',
                padding: '12px',
                border: day.isTuesday ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid rgba(255, 255, 255, 0.08)',
                opacity: day.isTuesday ? 0.65 : 1,
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between'
              }}>
                {/* Header Giorno */}
                <div style={{ textAlign: 'center', paddingBottom: '8px', marginBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: day.isTuesday ? '#64748b' : '#38bdf8', letterSpacing: '0.5px', display: 'block' }}>
                    {day.dayName}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                    {day.dayFormatted}
                  </span>
                </div>

                {day.isTuesday ? (
                  <div style={{
                    padding: '24px 8px',
                    textAlign: 'center',
                    background: 'rgba(30, 41, 59, 0.3)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    color: '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    letterSpacing: '0.5px'
                  }}>
                    🔒 CHIUSO
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {['pranzo', 'cena'].map(turno => {
                      if (day.isSunday && turno === 'pranzo') {
                        /* Spacer invisibile la Domenica a Pranzo per allineare perfettamente la Cena */
                        return (
                          <div key="sunday-pranzo-spacer-box2" style={{ visibility: 'hidden', padding: '6px 8px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                              <Sun size={11} /> Pranzo
                            </div>
                          </div>
                        );
                      }

                      const assignedEmps = employeesList.filter(emp => isAssigned(emp, day.dateStr, turno));

                      return (
                        <div key={turno} style={{
                          background: 'rgba(30, 41, 59, 0.5)',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255, 255, 255, 0.05)'
                        }}>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: turno === 'pranzo' ? '#fbbf24' : '#a5b4fc', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                            {turno === 'pranzo' ? <Sun size={11} /> : <Moon size={11} />}
                            <span style={{ textTransform: 'capitalize' }}>{turno}</span>
                          </div>

                          {assignedEmps.length === 0 ? (
                            <span style={{ fontSize: '0.68rem', color: '#475569', fontStyle: 'italic', display: 'block' }}>
                              Nessuno
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {assignedEmps.map(emp => (
                                <div key={emp.id} style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  color: '#34d399',
                                  background: 'rgba(16, 185, 129, 0.18)',
                                  padding: '3px 6px',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justify: 'space-between'
                                }}>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {emp.nome}
                                  </span>
                                  <span>✓</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      )}

    </div>
  );
}
