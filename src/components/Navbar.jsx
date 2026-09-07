import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ProfileModal from './ProfileModal';
import { Calendar, LogOut, Shield, User, Settings, Users } from 'lucide-react';

export default function Navbar({ onOpenSetup, adminActiveTab, setAdminActiveTab }) {
  const { user, employee, logout, isConfigured } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const isAdmin = employee?.ruolo === 'admin';

  return (
    <>
      <header
        className="glass-card header-navbar"
        style={{
          maxWidth: '1000px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(56, 189, 248, 0.08)'
        }}
      >
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          
          {/* Logo & App Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
              padding: '10px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(56, 189, 248, 0.3)'
            }}>
              <Calendar size={22} color="#0f172a" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, background: 'linear-gradient(90deg, #f8fafc, #cbd5e1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                App Turni
              </h1>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Ristorante & Catering</span>
            </div>
          </div>

          {/* Integrated Tab Switcher */}
          {user && setAdminActiveTab && (
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '12px', display: 'flex', gap: '4px', border: '1px solid rgba(255, 255, 255, 0.1)', flexWrap: 'wrap' }}>
              
              {/* Tab 1 (Mensile Personale): I Miei Turni */}
              <button
                type="button"
                onClick={() => setAdminActiveTab('my')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: adminActiveTab === 'my' ? 'linear-gradient(135deg, #38bdf8, #818cf8)' : 'transparent',
                  color: adminActiveTab === 'my' ? '#0f172a' : '#94a3b8',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  transition: 'all 0.2s'
                }}
              >
                <Calendar size={15} />
                I Miei Turni
              </button>

              {/* Tab 2 (Mensile Globale): Tutti i Dipendenti (Solo Admin) */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setAdminActiveTab('all')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: adminActiveTab === 'all' ? 'linear-gradient(135deg, #38bdf8, #818cf8)' : 'transparent',
                    color: adminActiveTab === 'all' ? '#0f172a' : '#94a3b8',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <Users size={15} />
                  Tutti i Dipendenti
                </button>
              )}

              {/* Tab 3 (Settimanale Personale): Le Mie Disponibilità */}
              <button
                type="button"
                onClick={() => setAdminActiveTab('availabilities')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: adminActiveTab === 'availabilities' ? 'linear-gradient(135deg, #38bdf8, #818cf8)' : 'transparent',
                  color: adminActiveTab === 'availabilities' ? '#0f172a' : '#94a3b8',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  transition: 'all 0.2s'
                }}
              >
                <span>📋</span>
                Le Mie Disponibilità
              </button>

              {/* Tab 4 (Settimanale Globale): Planning Settimanale (Solo Admin) */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setAdminActiveTab('planning')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: adminActiveTab === 'planning' ? 'linear-gradient(135deg, #38bdf8, #818cf8)' : 'transparent',
                    color: adminActiveTab === 'planning' ? '#0f172a' : '#94a3b8',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <span>🍕</span>
                  Planning Settimanale
                </button>
              )}
            </div>
          )}

          {/* User Info & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            
            {/* Config Button: VISIBLE ONLY FOR ADMIN OR BEFORE LOGIN */}
            {isConfigured && (!user || isAdmin) && (
              <button
                onClick={onOpenSetup}
                title="Configurazione Supabase (Solo Admin)"
                className="btn-secondary"
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <Settings size={16} />
                <span className="hidden-mobile">Config API</span>
              </button>
            )}

            {user && (
              <>
                {/* User Profile Badge -> Opens Profile Modal */}
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    cursor: 'pointer',
                    color: '#f8fafc',
                    transition: 'all 0.2s'
                  }}
                  title="Clicca per gestire il tuo profilo, ruoli ed eliminazione account"
                >
                  {isAdmin ? <Shield size={16} color="#38bdf8" /> : <User size={16} color="#818cf8" />}
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    {employee?.nome || user.email?.split('@')[0]}
                  </span>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: isAdmin ? 'rgba(56, 189, 248, 0.2)' : 'rgba(129, 140, 248, 0.2)',
                    color: isAdmin ? '#38bdf8' : '#a5b4fc',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}>
                    {employee?.ruolo || 'dipendente'}
                  </span>
                </button>

                {/* Logout Button */}
                <button
                  onClick={logout}
                  className="btn-danger"
                  style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Disconnetti"
                >
                  <LogOut size={16} />
                  <span className="hidden-mobile">Esci</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Profile Modal Component */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </>
  );
}
