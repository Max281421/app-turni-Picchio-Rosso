import React, { useState } from 'react';
import { getSupabaseCredentials, saveSupabaseConfig, clearSupabaseConfig } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Key, Globe, CheckCircle, Database, HelpCircle, ArrowLeft } from 'lucide-react';

export default function SetupConfig({ onClose }) {
  const { checkConfigAndInit } = useAuth();
  const currentCreds = getSupabaseCredentials();

  const [url, setUrl] = useState(currentCreds.url);
  const [key, setKey] = useState(currentCreds.key);
  const [savedMsg, setSavedMsg] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!url.trim() || !key.trim()) {
      alert('Inserisci sia l\'URL che l\'Anon Key di Supabase.');
      return;
    }

    saveSupabaseConfig(url, key);
    setSavedMsg('Configurazione salvata con successo!');
    await checkConfigAndInit();
    setTimeout(() => {
      if (onClose) onClose();
    }, 1000);
  };

  const handleClear = async () => {
    if (confirm('Sei sicuro di voler rimuovere la configurazione attuale?')) {
      clearSupabaseConfig();
      setUrl('');
      setKey('');
      setSavedMsg('Configurazione rimossa.');
      await checkConfigAndInit();
    }
  };

  return (
    <div style={{ maxWidth: '560px', margin: '30px auto', padding: '0 16px' }}>
      <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '10px', borderRadius: '12px' }}>
              <Database size={24} color="#38bdf8" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc' }}>
                Configurazione Supabase
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Connessione Database e Auth</span>
            </div>
          </div>

          {onClose && (
            <button onClick={onClose} className="btn-secondary" style={{ padding: '8px 12px' }}>
              <ArrowLeft size={16} /> Indietro
            </button>
          )}
        </div>

        {savedMsg && (
          <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#4ade80', fontSize: '0.85rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={18} />
            {savedMsg}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: 500 }}>
              Supabase Project URL
            </label>
            <div style={{ position: 'relative' }}>
              <Globe size={18} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="url"
                required
                placeholder="https://xyzxyzxyz.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="glass-input"
                style={{ paddingLeft: '42px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: 500 }}>
              Supabase Anon API Key
            </label>
            <div style={{ position: 'relative' }}>
              <Key size={18} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                required
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="glass-input"
                style={{ paddingLeft: '42px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>
              <CheckCircle size={18} />
              Salva e Connetti
            </button>
            {currentCreds.isConfigured && (
              <button type="button" onClick={handleClear} className="btn-danger">
                Rimuovi
              </button>
            )}
          </div>
        </form>

        {/* Instructions */}
        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#38bdf8' }}>
            <HelpCircle size={18} />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Dove trovo questi dati?</h4>
          </div>
          <ol style={{ fontSize: '0.85rem', color: '#94a3b8', paddingLeft: '20px', lineHeight: '1.6' }}>
            <li>Accedi a <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>supabase.com/dashboard</a></li>
            <li>Seleziona il tuo progetto (o creane uno gratuito)</li>
            <li>Vai in <strong>Project Settings</strong> (icona ingranaggio in basso a sinistra) e clicca su <strong>API</strong></li>
            <li>Copia la <strong>Project URL</strong> ed la chiave <strong>anon / public</strong>.</li>
          </ol>
        </div>

      </div>
    </div>
  );
}
