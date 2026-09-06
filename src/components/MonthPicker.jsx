import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

export default function MonthPicker({ currentYear, currentMonth, onChange }) {
  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const handlePrev = () => {
    if (currentMonth === 0) {
      onChange(currentYear - 1, 11);
    } else {
      onChange(currentYear, currentMonth - 1);
    }
  };

  const handleNext = () => {
    if (currentMonth === 11) {
      onChange(currentYear + 1, 0);
    } else {
      onChange(currentYear, currentMonth + 1);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
      <button onClick={handlePrev} className="btn-secondary" style={{ padding: '8px 12px' }} title="Mese precedente">
        <ChevronLeft size={20} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <CalendarIcon size={18} color="#38bdf8" />
        <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
          {monthNames[currentMonth]} {currentYear}
        </span>
      </div>

      <button onClick={handleNext} className="btn-secondary" style={{ padding: '8px 12px' }} title="Mese successivo">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
