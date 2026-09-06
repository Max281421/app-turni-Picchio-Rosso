import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, Shield, User, Mail, Lock, Sparkles, AlertCircle } from 'lucide-react';

export default function Login({ onOpenSetup }) {
  const { login, register, isConfigured } = useAuth();
  const [isRegister, setIsRegister] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [ruolo, setRuolo] = useState('dipendente');

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const nomeRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    // Leggi sia dallo stato React che direttamente dai riferimenti DOM per supportare l'autofill del browser
    const submittedEmail = emailRef.current?.value || email;
    const submittedPassword = passwordRef.current?.value || password;
    const submittedNome = nomeRef.current?.value || nome;

    try {
      if (isRegister) {
        if (!submittedNome.trim()) {
          throw new Error('Inserisci il tuo nome e cognome');
        }
        await register(submittedEmail, submittedPassword, submittedNome.trim(), ruolo);
        setSuccessMsg('Account creato con successo! Accesso in corso...');
      } else {
        await login(submittedEmail, submittedPassword);
      }
    } catch (err) {
      console.error('Auth error:', err);
      let msg = err.message || 'Errore durante la procedura';
      if (msg.includes('Invalid login credentials')) {
        msg = 'Email o password non corrette.';
      } else if (msg.includes('User already registered')) {
        msg = 'Questa email risulta già registrata. Effettua l\'accesso.';
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isConfigured) {
    return (
      <div style={{ maxWidth: '440px', margin: '40px auto', padding: '0 16px' }}>
        <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
          <AlertCircle size={48} color="#38bdf8" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '12px' }}>
            Configurazione Supabase Richiesta
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '24px' }}>
            L'applicazione deve essere collegata a un progetto Supabase gratuito per gestire l'autenticazione ed i turni.
          </p>
          <button onClick={onOpenSetup} className="btn-primary" style={{ width: '100%' }}>
            Configura Supabase Ora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '440px', margin: '30px auto', padding: '0 16px' }}>
      <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
        
        {/* Header Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
          <button
            type="button"
            onClick={() => { setIsRegister(false); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '12px',
              background: 'none',
              border: 'none',
              borderBottom: !isRegister ? '2px solid #38bdf8' : 'none',
              color: !isRegister ? '#38bdf8' : '#94a3b8',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <LogIn size={18} />
            Accedi
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '12px',
              background: 'none',
              border: 'none',
              borderBottom: isRegister ? '2px solid #38bdf8' : 'none',
              color: isRegister ? '#38bdf8' : '#94a3b8',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <UserPlus size={18} />
            Registrati
          </button>
        </div>

        {errorMsg && (
          <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.85rem', marginBottom: '16px' }}>
            <p style={{ marginBottom: errorMsg.includes('Invalid path') || errorMsg.includes('URL') ? '10px' : '0' }}>
              {errorMsg}
            </p>
            {(errorMsg.includes('Invalid path') || errorMsg.includes('URL') || errorMsg.includes('fetch')) && (
              <button
                type="button"
                onClick={onOpenSetup}
                className="btn-secondary"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 10px', marginTop: '6px' }}
              >
                Riapri Configurazione Supabase
              </button>
            )}
          </div>
        )}

        {successMsg && (
          <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#4ade80', fontSize: '0.85rem', marginBottom: '16px' }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {isRegister && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                Nome e Cognome
              </label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  ref={nomeRef}
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Es. Mario Rossi"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="glass-input"
                  style={{ paddingLeft: '42px' }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
              Indirizzo Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                ref={emailRef}
                type="email"
                required
                autoComplete="email"
                placeholder="mario@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input"
                style={{ paddingLeft: '42px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                ref={passwordRef}
                type="password"
                required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input"
                style={{ paddingLeft: '42px' }}
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                Ruolo Account
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setRuolo('dipendente')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: ruolo === 'dipendente' ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.1)',
                    background: ruolo === 'dipendente' ? 'rgba(129, 140, 248, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                    color: ruolo === 'dipendente' ? '#a5b4fc' : '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  <User size={16} />
                  Dipendente
                </button>

                <button
                  type="button"
                  onClick={() => setRuolo('admin')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: ruolo === 'admin' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                    background: ruolo === 'admin' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                    color: ruolo === 'admin' ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  <Shield size={16} />
                  Admin / Titolare
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', marginTop: '8px', padding: '14px' }}
          >
            {loading ? (
              'Caricamento in corso...'
            ) : isRegister ? (
              <>
                <Sparkles size={18} />
                Crea Account
              </>
            ) : (
              <>
                <LogIn size={18} />
                Accedi
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
