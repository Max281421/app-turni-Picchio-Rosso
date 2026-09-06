import React, { useState, useEffect } from 'react';
import { Download, Share, X, Smartphone } from 'lucide-react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Show prompt for iOS if not already dismissed
    if (ios && !localStorage.getItem('PWA_PROMPT_DISMISSED')) {
      setShowPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('PWA_PROMPT_DISMISSED', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="glass-card animate-fade-in" style={{
      marginBottom: '20px',
      padding: '16px 20px',
      borderLeft: '4px solid #38bdf8',
      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '10px', borderRadius: '12px' }}>
            <Smartphone size={24} color="#38bdf8" />
          </div>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              Installa l'App sul tuo telefono!
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px' }}>
              {isIOS ? (
                <>
                  Tocca il tasto Condividi <Share size={14} style={{ verticalAlign: 'middle', display: 'inline' }} /> in basso e seleziona <strong>"Aggiungi alla schermata Home"</strong>.
                </>
              ) : (
                'Installa questa app sulla schermata home per un accesso rapido ed offline.'
              )}
            </p>
          </div>
        </div>

        <button onClick={handleDismiss} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>

      {!isIOS && deferredPrompt && (
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleInstallClick} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            <Download size={16} />
            Installa Ora
          </button>
        </div>
      )}
    </div>
  );
}
