import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

export default function PullToRefresh({ children, onRefresh }) {
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchContainerRef = useRef(null);

  const PULL_THRESHOLD = 90; // Distanza in px necessaria per attivare il refresh

  useEffect(() => {
    const handleTouchStart = (e) => {
      // Non attivare mai se c'è un modale aperto
      if (document.querySelector('.modal-overlay')) {
        setStartY(0);
        return;
      }

      // Attiva solo se il tocco inizia nei primi 100px in cima alla pagina e lo scroll è a 0
      if (window.scrollY <= 2 && e.touches[0].clientY <= 100) {
        setStartY(e.touches[0].clientY);
      } else {
        setStartY(0);
      }
    };

    const handleTouchMove = (e) => {
      if (startY <= 0 || window.scrollY > 2 || refreshing || document.querySelector('.modal-overlay')) {
        return;
      }

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      if (diff > 0) {
        // Resistenza naturale al trascinamento
        const distance = Math.min(diff * 0.45, 110);
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance >= PULL_THRESHOLD && !refreshing) {
        setRefreshing(true);
        setPullDistance(PULL_THRESHOLD);

        try {
          if (onRefresh) {
            await onRefresh();
          } else {
            window.location.reload();
          }
        } catch (e) {
          console.error('Refresh error:', e);
          window.location.reload();
        } finally {
          setTimeout(() => {
            setRefreshing(false);
            setPullDistance(0);
          }, 600);
        }
      } else {
        setPullDistance(0);
      }
      setStartY(0);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [startY, pullDistance, refreshing, onRefresh]);

  const rotation = Math.min(pullDistance * 3.6, 360);
  const opacity = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div ref={touchContainerRef} style={{ position: 'relative', minHeight: '100vh' }}>
      
      {/* Indicatore visivo di Pull to Refresh */}
      {(pullDistance > 10 || refreshing) && (
        <div
          style={{
            position: 'fixed',
            top: `${Math.min(pullDistance * 0.6, 60)}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            padding: '8px 16px',
            borderRadius: '24px',
            opacity: refreshing ? 1 : opacity,
            transition: refreshing ? 'all 0.2s ease' : 'none',
            pointerEvents: 'none'
          }}
        >
          <RefreshCw
            size={18}
            color="#38bdf8"
            style={{
              transform: refreshing ? undefined : `rotate(${rotation}deg)`,
              animation: refreshing ? 'spin 0.8s linear infinite' : 'none'
            }}
          />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc' }}>
            {refreshing
              ? 'Aggiornamento in corso...'
              : pullDistance >= PULL_THRESHOLD
              ? 'Rilascia per ricaricare'
              : 'Trascina per ricaricare'}
          </span>
        </div>
      )}

      {children}
    </div>
  );
}
