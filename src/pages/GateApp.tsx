import React, { useState, useEffect } from 'react';
import { Truck, Scale, CheckCircle, XCircle, ChevronRight, ChevronLeft, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Embarque {
  id: string;
  manifesto: string;
  placa: string;
  motorista: string;
  filial: string;
  data_operacao: string;
  status: string;
  peso_total_esperado: number;
  peso_balanca: number | null;
}

const GateApp: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [embarques, setEmbarques] = useState<Embarque[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmbarque, setSelectedEmbarque] = useState<Embarque | null>(null);
  const [balancaValue, setBalancaValue] = useState('');
  const [liberandoLoading, setLiberandoLoading] = useState(false);

  const fetchEmbarques = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('manifesto_embarques')
      .select('*')
      .eq('data_operacao', selectedDate)
      .in('status', ['Aguardando Liberação', 'Revisão Armazém'])
      .order('criado_em', { ascending: false });

    if (!error && data) setEmbarques(data);
    setLoading(false);
  };

  useEffect(() => { fetchEmbarques(); }, [selectedDate]);

  // Real-time: se armazém devolver card, atualiza a lista
  useEffect(() => {
    const sub = supabase.channel('portaria_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manifesto_embarques' }, () => {
        fetchEmbarques();
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [selectedDate]);

  const handleSelectEmbarque = (emb: Embarque) => {
    setSelectedEmbarque(emb);
    setBalancaValue(emb.peso_balanca?.toString() || '');
  };

  const handleLiberarSaida = async () => {
    if (!selectedEmbarque) return;
    const pesoBalanca = parseFloat(balancaValue);
    if (isNaN(pesoBalanca) || pesoBalanca <= 0) {
      alert('Informe o peso da balança antes de liberar.');
      return;
    }

    setLiberandoLoading(true);
    try {
      // Atualiza o embarque para "Em Rota"
      const { error } = await supabase.from('manifesto_embarques').update({
        status: 'Em Rota',
        peso_balanca: pesoBalanca,
        liberado_por: 'Porteiro',
        liberado_em: new Date().toISOString(),
      }).eq('id', selectedEmbarque.id);

      if (error) throw error;

      // Atualiza o status das NFs para "Em Rota"
      await supabase.from('deliveries').update({
        status_entrega: 'Em Rota',
      }).eq('manifesto', selectedEmbarque.manifesto).eq('placa', selectedEmbarque.placa);

      alert(`✅ Veículo ${selectedEmbarque.placa} liberado para rota!`);
      setSelectedEmbarque(null);
      setBalancaValue('');
      fetchEmbarques();
    } catch (err: any) {
      alert('Erro ao liberar: ' + err.message);
    } finally {
      setLiberandoLoading(false);
    }
  };

  const handleBarrarMotorista = async () => {
    if (!selectedEmbarque) return;
    const pesoBalanca = parseFloat(balancaValue);
    if (isNaN(pesoBalanca) || pesoBalanca <= 0) {
      alert('Informe o peso da balança para registrar a divergência.');
      return;
    }

    const confirm = window.confirm(
      `⚠️ Barrar veículo ${selectedEmbarque.placa}?\n\nO card voltará para revisão no Armazém.`
    );
    if (!confirm) return;

    setLiberandoLoading(true);
    try {
      // Devolve o card para o armazém com status "Revisão Armazém"
      const { error } = await supabase.from('manifesto_embarques').update({
        status: 'Revisão Armazém',
        peso_balanca: pesoBalanca,
      }).eq('id', selectedEmbarque.id);

      if (error) throw error;

      // Reverte o status das NFs para que apareçam no Kanban do armazém
      await supabase.from('deliveries').update({
        status_conferencia: 'Pendente',
        status_entrega: 'Revisão Armazém',
      }).eq('manifesto', selectedEmbarque.manifesto).eq('placa', selectedEmbarque.placa);

      alert(`🚫 Veículo ${selectedEmbarque.placa} barrado. Card devolvido ao Armazém.`);
      setSelectedEmbarque(null);
      setBalancaValue('');
      fetchEmbarques();
    } catch (err: any) {
      alert('Erro ao barrar: ' + err.message);
    } finally {
      setLiberandoLoading(false);
    }
  };

  const diferencaPeso = selectedEmbarque && balancaValue
    ? (parseFloat(balancaValue) || 0) - selectedEmbarque.peso_total_esperado
    : null;

  const diferencaPercent = selectedEmbarque && selectedEmbarque.peso_total_esperado > 0 && diferencaPeso !== null
    ? ((Math.abs(diferencaPeso) / selectedEmbarque.peso_total_esperado) * 100).toFixed(1)
    : null;

  const statusColors: Record<string, { bg: string; color: string; label: string }> = {
    'Aguardando Liberação': { bg: '#FFF7ED', color: '#D97706', label: 'Aguardando' },
    'Revisão Armazém': { bg: '#FEF2F2', color: '#DC2626', label: 'Revisão Armazém' },
  };

  return (
    <div style={{ backgroundColor: '#F5F7FA', minHeight: '100vh', padding: '1rem', paddingBottom: '3rem' }}>
      {/* Header */}
      <div className="mb-4 d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center" style={{ gap: '1rem' }}>
          <div style={{ backgroundColor: '#1E3A5F', padding: '0.75rem', borderRadius: '12px' }}>
            <Scale color="white" size={28} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1E3A5F' }}>CTOE | Módulo Portaria</h1>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>CONTROLE DE SAÍDA DE VEÍCULOS</div>
          </div>
        </div>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }} onClick={fetchEmbarques}>
          <RefreshCw size={20} />
        </button>
      </div>

      {/* Detalhe do embarque selecionado */}
      {selectedEmbarque ? (
        <div className="animate-slide-up">
          <button className="d-flex align-items-center mb-3"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0F3B63', fontWeight: 600, gap: '0.25rem', padding: 0 }}
            onClick={() => { setSelectedEmbarque(null); setBalancaValue(''); }}>
            <ChevronLeft size={20} /> Voltar para lista
          </button>

          <div className="card p-4 border-0 mb-3" style={{ borderRadius: '16px', boxShadow: '0 4px 16px rgba(15,59,99,0.1)' }}>
            {/* Info do veículo */}
            <div className="d-flex justify-content-between align-items-start mb-4">
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0F3B63', letterSpacing: '2px' }}>{selectedEmbarque.placa}</div>
                <div style={{ color: '#64748B', fontSize: '0.875rem' }}>Motorista: <strong>{selectedEmbarque.motorista}</strong></div>
                <div style={{ color: '#64748B', fontSize: '0.875rem' }}>Manifesto: <strong>{selectedEmbarque.manifesto}</strong></div>
                <div style={{ color: '#64748B', fontSize: '0.875rem' }}>Filial: <strong>{selectedEmbarque.filial}</strong></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.25rem' }}>STATUS</div>
                <span style={{ padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, backgroundColor: statusColors[selectedEmbarque.status]?.bg, color: statusColors[selectedEmbarque.status]?.color }}>
                  {statusColors[selectedEmbarque.status]?.label}
                </span>
              </div>
            </div>

            {/* Comparação de pesos */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, marginBottom: '0.25rem' }}>PESO ESPERADO (Armazém)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F3B63' }}>{selectedEmbarque.peso_total_esperado.toFixed(2)} kg</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, marginBottom: '0.25rem' }}>PESO DA BALANÇA</div>
                  <input type="number" step="0.01" min="0"
                    style={{ width: '100%', fontSize: '1.4rem', fontWeight: 700, border: '2px solid #CBD5E1', borderRadius: '8px', padding: '0.25rem 0.5rem', textAlign: 'center', color: '#0F3B63' }}
                    placeholder="0.00"
                    value={balancaValue}
                    onChange={e => setBalancaValue(e.target.value)} />
                </div>
              </div>

              {/* Diferença calculada */}
              {balancaValue && diferencaPeso !== null && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '8px',
                  backgroundColor: Math.abs(diferencaPeso) > selectedEmbarque.peso_total_esperado * 0.05 ? '#FEF2F2' : '#F0FDF4',
                  border: `1px solid ${Math.abs(diferencaPeso) > selectedEmbarque.peso_total_esperado * 0.05 ? '#FEE2E2' : '#D1FAE5'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: Math.abs(diferencaPeso) > selectedEmbarque.peso_total_esperado * 0.05 ? '#991B1B' : '#166534' }}>
                        {diferencaPeso > 0 ? '▲ Excesso' : diferencaPeso < 0 ? '▼ Falta' : '✓ Peso OK'}
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: Math.abs(diferencaPeso) > selectedEmbarque.peso_total_esperado * 0.05 ? '#DC2626' : '#16A34A' }}>
                        {diferencaPeso > 0 ? '+' : ''}{diferencaPeso.toFixed(2)} kg
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Diferença</div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: Math.abs(diferencaPeso) > selectedEmbarque.peso_total_esperado * 0.05 ? '#DC2626' : '#16A34A' }}>
                        {diferencaPercent}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Aviso de decisão humana */}
            <div className="d-flex align-items-start p-3 mb-4" style={{ gap: '0.75rem', backgroundColor: '#EFF6FF', borderRadius: '10px', border: '1px solid #BFDBFE' }}>
              <AlertTriangle size={18} color="#3B82F6" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div style={{ fontSize: '0.825rem', color: '#1E40AF', lineHeight: 1.5 }}>
                <strong>Decisão humana.</strong> Avalie a diferença de peso e escolha a ação abaixo. O sistema não bloqueia automaticamente.
              </div>
            </div>

            {/* Botões de ação */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button onClick={handleBarrarMotorista} disabled={liberandoLoading}
                style={{ padding: '1rem', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: '#EF4444', color: 'white', fontWeight: 700, fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <XCircle size={24} />
                Divergência — Barrar
              </button>
              <button onClick={handleLiberarSaida} disabled={liberandoLoading}
                style={{ padding: '1rem', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: '#16A34A', color: 'white', fontWeight: 700, fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={24} />
                Liberar Saída
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Lista de veículos do dia */
        <div>
          <div className="d-flex align-items-center mb-3" style={{ gap: '1rem' }}>
            <div className="flex-grow-1">
              <label className="form-label">Data do Carregamento</label>
              <input type="date" className="form-control" value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)} style={{ fontWeight: 600 }} />
            </div>
          </div>

          {loading && (
            <div className="text-center p-5 text-muted">Carregando...</div>
          )}

          {!loading && embarques.length === 0 && (
            <div className="card p-5 border-0 text-center" style={{ borderRadius: '16px' }}>
              <Truck size={48} color="#CBD5E1" style={{ margin: '0 auto 1rem' }} />
              <p style={{ color: '#94A3B8', margin: 0 }}>Nenhum veículo aguardando liberação nesta data.</p>
            </div>
          )}

          <div className="d-flex flex-column" style={{ gap: '0.75rem' }}>
            {embarques.map(emb => {
              const sc = statusColors[emb.status] || { bg: '#F8FAFC', color: '#64748B', label: emb.status };
              return (
                <div key={emb.id} className="card p-3 border-0 card-hover"
                  style={{ borderRadius: '14px', boxShadow: '0 2px 8px rgba(15,59,99,0.08)', cursor: 'pointer', borderLeft: `4px solid ${sc.color}` }}
                  onClick={() => handleSelectEmbarque(emb)}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F3B63', letterSpacing: '1px' }}>{emb.placa}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748B' }}>Man: {emb.manifesto} · {emb.motorista}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748B' }}>Peso: <strong>{emb.peso_total_esperado.toFixed(2)} kg</strong></div>
                    </div>
                    <div className="d-flex align-items-center" style={{ gap: '0.75rem' }}>
                      <span style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                      <ChevronRight size={18} color="#94A3B8" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 text-center" style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
        CTOE · Módulo Portaria · Controle de Saída
      </div>
    </div>
  );
};

export default GateApp;
