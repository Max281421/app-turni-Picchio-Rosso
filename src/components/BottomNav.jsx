import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Calendar, Users, CalendarCheck, LayoutGrid } from 'lucide-react';

export default function BottomNav({ adminActiveTab, setAdminActiveTab }) {
  const { user, employee } = useAuth();
  const isAdmin = employee?.ruolo === 'admin';

  if (!user) return null;

  const tabs = [
    {
      id: 'my',
      label: 'I Miei Turni',
      icon: Calendar,
      show: true,
    },
    {
      id: 'all',
      label: 'Tutti i Dipendenti',
      icon: Users,
      show: isAdmin,
    },
    {
      id: 'availabilities',
      label: 'Le Mie Disponibilità',
      icon: CalendarCheck,
      show: true,
    },
    {
      id: 'planning',
      label: 'Planning Settimanale',
      icon: LayoutGrid,
      show: isAdmin,
    },
  ].filter((tab) => tab.show);

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-container">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = adminActiveTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAdminActiveTab(tab.id)}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <div className="bottom-nav-icon-wrapper">
                <Icon size={20} />
              </div>
              <span className="bottom-nav-label">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
