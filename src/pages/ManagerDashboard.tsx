import React from 'react';
import { BarChart3, TrendingUp, TrendingDown, Clock, AlertTriangle, Truck } from 'lucide-react';

const ManagerDashboard: React.FC = () => {
  return (
    <div style={{ backgroundColor: 'var(--color-bg-main)', minHeight: '100vh' }}>
      <header style={{ backgroundColor: 'var(--color-primary)', color: 'white', padding: '1.5rem 2rem', boxShadow: 'var(--shadow-md)' }}>
        <div className="container d-flex justify-content-between align-items-center" style={{ maxWidth: '1400px' }}>
          <div className="d-flex align-items-center" style={{ gap: '1rem' }}>
            <BarChart3 size={28} />
            <h1 style={{ fontSize: '1.5rem', margin: 0 }}>CTOE | Dashboard Gerencial</h1>
          </div>
          <div>
            <span className="text-muted" style={{ marginRight: '1rem' }}>Última atualização: Hoje, 10:45</span>
            <button className="btn btn-secondary" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }}>Exportar Relatório</button>
          </div>
        </div>
      </header>

      <div className="container mt-4" style={{ maxWidth: '1400px' }}>
        <div className="d-flex mb-4" style={{ gap: '1.5rem' }}>
          {/* KPI Cards */}
          <div className="card w-100" style={{ padding: '1.5rem', borderLeft: '4px solid var(--color-info)' }}>
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-muted" style={{ fontWeight: 600 }}>Ocorrências Abertas</span>
              <AlertTriangle size={20} color="var(--color-info)" />
            </div>
            <h2 style={{ fontSize: '2.5rem', margin: '0 0 0.5rem 0' }}>42</h2>
            <div className="d-flex align-items-center" style={{ gap: '0.25rem', color: 'var(--color-danger)', fontSize: '0.875rem' }}>
              <TrendingUp size={16} />
              <span>+12% vs ontem</span>
            </div>
          </div>

          <div className="card w-100" style={{ padding: '1.5rem', borderLeft: '4px solid var(--color-danger)' }}>
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-muted" style={{ fontWeight: 600 }}>SLA Estourado</span>
              <Clock size={20} color="var(--color-danger)" />
            </div>
            <h2 style={{ fontSize: '2.5rem', margin: '0 0 0.5rem 0', color: 'var(--color-danger)' }}>5</h2>
            <div className="d-flex align-items-center" style={{ gap: '0.25rem', color: 'var(--color-danger)', fontSize: '0.875rem' }}>
              <TrendingUp size={16} />
              <span>+2 vs ontem</span>
            </div>
          </div>

          <div className="card w-100" style={{ padding: '1.5rem', borderLeft: '4px solid var(--color-success)' }}>
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-muted" style={{ fontWeight: 600 }}>TMA (Tempo Médio)</span>
              <Clock size={20} color="var(--color-success)" />
            </div>
            <h2 style={{ fontSize: '2.5rem', margin: '0 0 0.5rem 0' }}>14m</h2>
            <div className="d-flex align-items-center" style={{ gap: '0.25rem', color: 'var(--color-success)', fontSize: '0.875rem' }}>
              <TrendingDown size={16} />
              <span>-3m vs ontem</span>
            </div>
          </div>

          <div className="card w-100" style={{ padding: '1.5rem', borderLeft: '4px solid var(--color-warning)' }}>
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-muted" style={{ fontWeight: 600 }}>Veículos em Rota</span>
              <Truck size={20} color="var(--color-warning)" />
            </div>
            <h2 style={{ fontSize: '2.5rem', margin: '0 0 0.5rem 0' }}>128</h2>
            <div className="d-flex align-items-center" style={{ gap: '0.25rem', color: 'var(--color-success)', fontSize: '0.875rem' }}>
              <TrendingUp size={16} />
              <span>98% da frota</span>
            </div>
          </div>
        </div>

        <div className="d-flex" style={{ gap: '1.5rem' }}>
          <div className="card w-100" style={{ padding: '1.5rem', flex: 2 }}>
            <h3 className="mb-4">Evolução de Ocorrências</h3>
            <div style={{ height: '300px', backgroundColor: 'var(--color-bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
              <span className="text-muted">Gráfico de Linha (Chart.js / Recharts)</span>
            </div>
          </div>
          <div className="card w-100" style={{ padding: '1.5rem', flex: 1 }}>
            <h3 className="mb-4">Top Motivos</h3>
            <div className="d-flex flex-column" style={{ gap: '1rem' }}>
              <div>
                <div className="d-flex justify-content-between mb-1">
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Cliente Fechado</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>45%</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--color-bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '45%', height: '100%', backgroundColor: 'var(--color-primary)' }}></div>
                </div>
              </div>
              <div>
                <div className="d-flex justify-content-between mb-1">
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Demora na descarga</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>30%</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--color-bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '30%', height: '100%', backgroundColor: 'var(--color-warning)' }}></div>
                </div>
              </div>
              <div>
                <div className="d-flex justify-content-between mb-1">
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Avaria</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>15%</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--color-bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '15%', height: '100%', backgroundColor: 'var(--color-danger)' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
