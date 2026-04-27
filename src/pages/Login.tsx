import React from 'react';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const navigate = useNavigate();

  const handleLogin = (role: string) => {
    if (role === 'driver') navigate('/driver');
    if (role === 'monitor') navigate('/monitor');
    if (role === 'dashboard') navigate('/dashboard');
  };

  return (
    <div className="container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: '400px' }}>
        <div className="text-center mb-4">
          <h1 style={{ color: 'var(--color-primary)' }}>CTOE</h1>
          <p className="text-muted">Central de Tratativas de Ocorrências</p>
        </div>
        <div className="flex-column" style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-primary" onClick={() => handleLogin('driver')}>
            Entrar como Motorista
          </button>
          <button className="btn btn-secondary" onClick={() => handleLogin('monitor')}>
            Entrar como Monitor
          </button>
          <button className="btn btn-secondary" onClick={() => handleLogin('dashboard')}>
            Entrar como Gestor
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
