import React, { useState, Component } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDashboard from './pages/AdminDashboard';
import SetupConfig from './pages/SetupConfig';
import PullToRefresh from './components/PullToRefresh';
import WeeklyPlanning from './components/WeeklyPlanning';
import { Calendar, Shield, Users, RefreshCw } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ maxWidth: '440px', margin: '40px auto', padding: '0 16px', textAlign: 'center' }}>
          <div className="glass-card" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f87171', marginBottom: '12px' }}>
              Caricamento Applicazione
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '20px' }}>
              {this.state.error?.message || 'Si è verificato un errore durante l\'inizializzazione del dispositivo.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              <RefreshCw size={18} />
              Ricarica Pagina
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainContent() {
  const { user, employee, loading, isConfigured } = useAuth();
  const [showSetup, setShowSetup] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState('my'); // 'my' | 'all' | 'planning'

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(56, 189, 248, 0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Caricamento App Turni...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isAdmin = employee?.ruolo === 'admin';

  if (showSetup) {
    if (user && !isAdmin) {
      setShowSetup(false);
    } else {
      return <SetupConfig onClose={() => setShowSetup(false)} />;
    }
  }

  if (!isConfigured) {
    return <Login onOpenSetup={() => setShowSetup(true)} />;
  }

  if (!user) {
    return <Login onOpenSetup={() => setShowSetup(true)} />;
  }

  return (
    <>
      <Navbar
        onOpenSetup={() => setShowSetup(true)}
        adminActiveTab={adminActiveTab}
        setAdminActiveTab={setAdminActiveTab}
      />

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 16px' }}>
        {adminActiveTab === 'planning' ? (
          <WeeklyPlanning />
        ) : isAdmin ? (
          adminActiveTab === 'all' ? <AdminDashboard /> : <EmployeeDashboard />
        ) : (
          <EmployeeDashboard />
        )}
      </main>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PullToRefresh>
          <MainContent />
        </PullToRefresh>
      </AuthProvider>
    </ErrorBoundary>
  );
}
