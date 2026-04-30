import React, { useState, useRef, useEffect } from 'react';
import {
  Package, Truck, Camera, CheckCircle, AlertCircle, ArrowRight,
  ShieldCheck, Thermometer, Image as ImageIcon, AlertTriangle, Scale,
  RefreshCw, ClipboardList, RotateCcw
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Delivery {
  id: string;
  nf: string;
  cliente: string;
  placa: string;
  manifesto: string;
  motorista: string;
  filial: string;
  qtd_caixas: number;
  peso_kg: number;
}

interface NfResult {
  deliveryId: string;
  nf: string;
  pesoRealCarregado: number;
  qtdContada: number;
  temFalta: boolean;
  pesoFaltaKg: number;
}

interface ManifestoCard {
  placa: string;
  manifesto: string;
  motorista: string;
  filial: string;
  total_nfs: number;
  status: 'Pendente' | 'Revisão Armazém';
}

const WarehouseApp: React.FC = () => {
  const [step, setStep] = useState(0); // 0 = fila, 1 removido, 2 = conferencia, 3 = fotos
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 0: Queue
  const [queue, setQueue] = useState<ManifestoCard[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);

  // Selected manifesto (replaces auth)
  const [authPlaca, setAuthPlaca] = useState('');
  const [authManifesto, setAuthManifesto] = useState('');
  const [manifestoDeliveries, setManifestoDeliveries] = useState<Delivery[]>([]);

  // Step 2: Blind counting + 3-error rule
  const [currentNfIndex, setCurrentNfIndex] = useState(0);
  const [countingValue, setCountingValue] = useState('');
  const [errorCount, setErrorCount] = useState(0); // contador de erros por NF
  const [showShortageForm, setShowShortageForm] = useState(false);
  const [shortageQtd, setShortageQtd] = useState('');
  const [shortagePeso, setShortagePeso] = useState('');

  // Resultados acumulados por NF (para calcular peso total)
  const [nfResults, setNfResults] = useState<NfResult[]>([]);

  // Step 3: Photos
  const [photos, setPhotos] = useState<{ [key: string]: string | null }>({
    mercadoria: null, termometro: null, caminhao: null
  });
  const [uploadingPhotos, setUploadingPhotos] = useState<{ [key: string]: boolean }>({
    mercadoria: false, termometro: false, caminhao: false
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePhotoType, setActivePhotoType] = useState<string | null>(null);

  /* ---------- FILA DE CARREGAMENTO ---------- */
  const fetchQueue = async () => {
    setQueueLoading(true);
    const { data } = await supabase
      .from('deliveries')
      .select('placa, manifesto, motorista, filial, status_conferencia, status_entrega')
      .or('status_conferencia.eq.Pendente,status_entrega.eq.Revisão Armazém');

    if (data) {
      // Agrupa por placa+manifesto
      const map: Record<string, ManifestoCard> = {};
      data.forEach(d => {
        const key = `${d.placa}_${d.manifesto}`;
        if (!map[key]) {
          const isRevisao = d.status_entrega === 'Revisão Armazém';
          map[key] = { placa: d.placa, manifesto: d.manifesto, motorista: d.motorista, filial: d.filial, total_nfs: 0, status: isRevisao ? 'Revisão Armazém' : 'Pendente' };
        }
        map[key].total_nfs += 1;
        // Se qualquer NF está em revisão, o card é revisão
        if (d.status_entrega === 'Revisão Armazém') map[key].status = 'Revisão Armazém';
      });
      setQueue(Object.values(map));
    }
    setQueueLoading(false);
  };

  useEffect(() => { fetchQueue(); }, []);

  // Realtime: atualiza fila quando portaria devolve card
  useEffect(() => {
    const sub = supabase.channel('warehouse_queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, fetchQueue)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const resetState = () => {
    setStep(0); setAuthPlaca(''); setAuthManifesto('');
    setManifestoDeliveries([]); setCurrentNfIndex(0);
    setCountingValue(''); setErrorCount(0);
    setShowShortageForm(false); setShortageQtd(''); setShortagePeso('');
    setNfResults([]);
    setPhotos({ mercadoria: null, termometro: null, caminhao: null });
    setError(null);
    fetchQueue();
  };

  /* ---------- SELECIONAR MANIFESTO DA FILA ---------- */
  const selectManifesto = async (card: ManifestoCard) => {
    setLoading(true);
    setError(null);
    const statusFilter = card.status === 'Revisão Armazém' ? 'Revisão Armazém' : 'Pendente';
    const query = supabase
      .from('deliveries')
      .select('id, nf, cliente, placa, manifesto, motorista, filial, qtd_caixas, peso_kg')
      .eq('placa', card.placa)
      .eq('manifesto', card.manifesto);

    const { data } = card.status === 'Revisão Armazém'
      ? await query.eq('status_entrega', statusFilter)
      : await query.eq('status_conferencia', 'Pendente');

    if (data && data.length > 0) {
      setAuthPlaca(card.placa);
      setAuthManifesto(card.manifesto);
      setManifestoDeliveries(data);
      setStep(2);
    } else {
      alert('NFs não encontradas para este manifesto.');
    }
    setLoading(false);
  };

  /* ---------- PASSO 2: CONFERÊNCIA CEGA ---------- */
  const handleConfirmCount = () => {
    const currentNf = manifestoDeliveries[currentNfIndex];
    const count = parseInt(countingValue);

    if (isNaN(count) || count !== currentNf.qtd_caixas) {
      const newErrorCount = errorCount + 1;
      setErrorCount(newErrorCount);
      setCountingValue('');

      if (newErrorCount >= 3) {
        // Regra dos 3 erros: mostra formulário de falta
        setError(null);
        setShowShortageForm(true);
      } else {
        setError(`Quantidade incorreta. Reconte as caixas. (${newErrorCount}/3 tentativas)`);
      }
      return;
    }

    // Contagem correta: registra resultado sem falta
    const result: NfResult = {
      deliveryId: currentNf.id,
      nf: currentNf.nf,
      pesoRealCarregado: currentNf.peso_kg,
      qtdContada: count,
      temFalta: false,
      pesoFaltaKg: 0,
    };
    advanceNf(result);
  };

  const handleReportShortage = () => {
    const currentNf = manifestoDeliveries[currentNfIndex];
    const qtdContada = parseInt(shortageQtd);
    const pesoFalta = parseFloat(shortagePeso);

    if (isNaN(qtdContada) || qtdContada < 0) {
      alert('Informe a quantidade de caixas contadas.');
      return;
    }
    if (isNaN(pesoFalta) || pesoFalta < 0) {
      alert('Informe o peso da falta em kg.');
      return;
    }

    // Lógica de subtração: Peso Total da NF - Peso da Falta = Peso Real Carregado
    const pesoRealCarregado = currentNf.peso_kg - pesoFalta;

    const result: NfResult = {
      deliveryId: currentNf.id,
      nf: currentNf.nf,
      pesoRealCarregado: Math.max(pesoRealCarregado, 0),
      qtdContada,
      temFalta: true,
      pesoFaltaKg: pesoFalta,
    };

    setShowShortageForm(false);
    setShortageQtd('');
    setShortagePeso('');
    setErrorCount(0);
    advanceNf(result);
  };

  const advanceNf = (result: NfResult) => {
    const updated = [...nfResults, result];
    setNfResults(updated);
    setError(null);
    setCountingValue('');
    setErrorCount(0);

    if (currentNfIndex < manifestoDeliveries.length - 1) {
      setCurrentNfIndex(currentNfIndex + 1);
    } else {
      setStep(3);
    }
  };

  /* ---------- PASSO 3: FOTOS ---------- */
  const handlePhotoClick = (type: string) => {
    setActivePhotoType(type);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePhotoType) return;
    setUploadingPhotos(prev => ({ ...prev, [activePhotoType]: true }));
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_warehouse_${activePhotoType}_${authManifesto}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('ctoe-attachments').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from('ctoe-attachments').getPublicUrl(fileName);
      setPhotos(prev => ({ ...prev, [activePhotoType]: publicUrl.publicUrl }));
    } catch (err: any) {
      alert('Erro no upload: ' + err.message);
    } finally {
      setUploadingPhotos(prev => ({ ...prev, [activePhotoType]: false }));
      setActivePhotoType(null);
      if (e.target) e.target.value = '';
    }
  };

  /* ---------- FINALIZAR EMBARQUE ---------- */
  const handleFinalize = async () => {
    setLoading(true);
    const photoUrls = [photos.mercadoria, photos.termometro, photos.caminhao] as string[];

    // Peso total = soma de todos os pesos reais carregados
    const pesoTotalEsperado = nfResults.reduce((acc, r) => acc + r.pesoRealCarregado, 0);
    const primeiraDelivery = manifestoDeliveries[0];

    try {
      // Atualiza cada NF individualmente com seus dados de conferência
      for (const result of nfResults) {
        await supabase.from('deliveries').update({
          status_conferencia: 'Conferido',
          qtd_caixas_contadas: result.qtdContada,
          peso_real_carregado: result.pesoRealCarregado,
          tem_falta: result.temFalta,
          peso_falta_kg: result.pesoFaltaKg,
          fotos_embarque: photoUrls,
          status_entrega: 'Aguardando Liberação Portaria',
        }).eq('id', result.deliveryId);
      }

      // Cria ou atualiza o registro do manifesto para a portaria
      const { error: embarqueError } = await supabase.from('manifesto_embarques').upsert({
        manifesto: authManifesto,
        placa: authPlaca.toUpperCase(),
        motorista: primeiraDelivery.motorista,
        filial: primeiraDelivery.filial,
        data_operacao: new Date().toISOString().split('T')[0],
        status: 'Aguardando Liberação',
        peso_total_esperado: pesoTotalEsperado,
        fotos_embarque: photoUrls,
      }, { onConflict: 'manifesto,placa' });

      if (embarqueError) throw embarqueError;

      alert(`Embarque Finalizado!\nPeso Total Carregado: ${pesoTotalEsperado.toFixed(2)} kg\nAguardando liberação na Portaria.`);
      resetState();
    } catch (err: any) {
      alert('Erro ao finalizar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const allPhotosCaptured = photos.mercadoria && photos.termometro && photos.caminhao;
  const currentNf = manifestoDeliveries[currentNfIndex];
  const pesoAcumulado = nfResults.reduce((acc, r) => acc + r.pesoRealCarregado, 0);

  return (
    <div style={{ backgroundColor: '#F5F7FA', minHeight: '100vh', padding: '1rem', paddingBottom: '3rem' }}>
      {/* Header */}
      <div className="mb-4 d-flex align-items-center" style={{ gap: '1rem' }}>
        <div style={{ backgroundColor: '#0F3B63', padding: '0.75rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(15,59,99,0.2)' }}>
          <Truck color="white" size={28} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0F3B63' }}>CTOE | Módulo Armazém</h1>
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>CONFERÊNCIA CEGA DE EMBARQUE</div>
        </div>
      </div>

      {/* ===== PASSO 0: FILA DE CARREGAMENTO ===== */}
      {step === 0 && (
        <div className="animate-slide-up">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h3 style={{ margin: 0, fontWeight: 700, color: '#1E293B', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardList size={20} color="#0F3B63" /> Fila de Carregamento
            </h3>
            <button onClick={fetchQueue} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
              <RefreshCw size={16} /> Atualizar
            </button>
          </div>

          {queueLoading && (
            <div className="text-center p-5 text-muted">Carregando fila...</div>
          )}

          {!queueLoading && queue.length === 0 && (
            <div className="card p-5 border-0 text-center" style={{ borderRadius: '16px' }}>
              <Truck size={48} color="#CBD5E1" style={{ margin: '0 auto 1rem' }} />
              <p style={{ color: '#94A3B8', margin: 0, fontWeight: 600 }}>Nenhuma carga pendente no momento.</p>
              <p style={{ color: '#CBD5E1', fontSize: '0.8rem', marginTop: '0.25rem' }}>Aguardando dados da automação.</p>
            </div>
          )}

          {/* Coluna: Pendente */}
          {queue.filter(c => c.status === 'Pendente').length > 0 && (
            <div className="mb-4">
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                📦 Aguardando Conferência ({queue.filter(c => c.status === 'Pendente').length})
              </div>
              <div className="d-flex flex-column" style={{ gap: '0.75rem' }}>
                {queue.filter(c => c.status === 'Pendente').map(card => (
                  <div key={`${card.placa}_${card.manifesto}`}
                    className="card border-0 card-hover"
                    style={{ borderRadius: '14px', boxShadow: '0 2px 8px rgba(15,59,99,0.1)', cursor: 'pointer', borderLeft: '4px solid #0F3B63' }}
                    onClick={() => selectManifesto(card)}>
                    <div className="p-3 d-flex justify-content-between align-items-center">
                      <div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F3B63', letterSpacing: '2px' }}>{card.placa}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748B' }}>Man: {card.manifesto} · {card.motorista}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748B' }}>Filial: {card.filial}</div>
                      </div>
                      <div className="text-right">
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F3B63' }}>{card.total_nfs}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>NFs</div>
                        <div style={{ marginTop: '0.5rem', padding: '0.2rem 0.6rem', borderRadius: '20px', backgroundColor: '#EFF6FF', color: '#1D4ED8', fontSize: '0.75rem', fontWeight: 600 }}>Pendente</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coluna: Revisão Armazém (devolvidos pela portaria) */}
          {queue.filter(c => c.status === 'Revisão Armazém').length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                🔁 Devolvidos pela Portaria — Revisão ({queue.filter(c => c.status === 'Revisão Armazém').length})
              </div>
              <div className="d-flex flex-column" style={{ gap: '0.75rem' }}>
                {queue.filter(c => c.status === 'Revisão Armazém').map(card => (
                  <div key={`${card.placa}_${card.manifesto}_rev`}
                    className="card border-0 card-hover"
                    style={{ borderRadius: '14px', boxShadow: '0 2px 8px rgba(220,38,38,0.1)', cursor: 'pointer', borderLeft: '4px solid #DC2626' }}
                    onClick={() => selectManifesto(card)}>
                    <div className="p-3 d-flex justify-content-between align-items-center">
                      <div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#DC2626', letterSpacing: '2px' }}>{card.placa}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748B' }}>Man: {card.manifesto} · {card.motorista}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748B' }}>Filial: {card.filial}</div>
                      </div>
                      <div className="text-right">
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#DC2626' }}>{card.total_nfs}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>NFs</div>
                        <div style={{ marginTop: '0.5rem', padding: '0.2rem 0.6rem', borderRadius: '20px', backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <RotateCcw size={10} /> Revisão
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== PASSO 2: CONFERÊNCIA CEGA ===== */}
      {step === 2 && currentNf && !showShortageForm && (
        <div className="animate-slide-up">
          {/* Progresso */}
          <div className="card p-3 mb-3 border-0" style={{ borderRadius: '12px', backgroundColor: '#0F3B63' }}>
            <div className="d-flex justify-content-between align-items-center text-white">
              <div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>PROGRESSO DO MANIFESTO</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{currentNfIndex + 1} / {manifestoDeliveries.length} NFs</div>
              </div>
              <div className="text-right">
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>PESO ACUMULADO</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{pesoAcumulado.toFixed(1)} kg</div>
              </div>
            </div>
            <div style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '2px', marginTop: '0.75rem' }}>
              <div style={{ height: '100%', width: `${((currentNfIndex) / manifestoDeliveries.length) * 100}%`, backgroundColor: '#27AE60', borderRadius: '2px', transition: 'width 0.3s ease' }} />
            </div>
          </div>

          <div className="card p-4 border-0" style={{ borderRadius: '16px', boxShadow: '0 4px 16px rgba(15,59,99,0.1)' }}>
            <div className="text-center mb-4">
              <div style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '0.5rem' }}>Nota Fiscal em Conferência</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0F3B63', letterSpacing: '2px' }}>{currentNf.nf}</div>
              <div style={{ fontSize: '0.875rem', color: '#64748B', marginTop: '0.25rem' }}>{currentNf.cliente}</div>
            </div>

            <div className="p-4 mb-4" style={{ border: '2px dashed #CBD5E1', borderRadius: '12px', backgroundColor: '#FAFBFC' }}>
              <div className="text-center mb-3">
                <Package size={40} color="#94A3B8" />
              </div>
              <label className="form-label text-center w-100">Quantas caixas você contou?</label>
              <input type="number" className="form-control text-center"
                style={{ fontSize: '2rem', fontWeight: 700, padding: '0.75rem', borderRadius: '12px' }}
                placeholder="0" min="0"
                value={countingValue}
                onChange={e => setCountingValue(e.target.value)}
                autoFocus />
            </div>

            {error && (
              <div className="d-flex align-items-center p-3 mb-4" style={{ gap: '0.75rem', borderRadius: '10px', backgroundColor: '#FFF7ED', border: '1px solid #FED7AA', color: '#92400E' }}>
                <AlertTriangle size={20} />
                <div>
                  <div style={{ fontWeight: 700 }}>{error}</div>
                  {errorCount >= 2 && <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>⚠️ Próximo erro libera formulário de falta.</div>}
                </div>
              </div>
            )}

            <button className="btn btn-primary w-100" onClick={handleConfirmCount}
              style={{ padding: '0.875rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 600 }}>
              Confirmar Contagem <ArrowRight size={20} style={{ marginLeft: '0.5rem' }} />
            </button>
          </div>
        </div>
      )}

      {/* ===== PASSO 2B: FORMULÁRIO DE FALTA (após 3 erros) ===== */}
      {step === 2 && currentNf && showShortageForm && (
        <div className="animate-slide-up">
          <div className="card p-4 border-0" style={{ borderRadius: '16px', boxShadow: '0 4px 16px rgba(231,76,60,0.15)', borderTop: '4px solid #E74C3C' }}>
            <div className="text-center mb-4">
              <AlertTriangle size={48} color="#E74C3C" style={{ marginBottom: '0.5rem' }} />
              <h3 style={{ color: '#E74C3C', fontWeight: 700, margin: 0 }}>Reportar Falta</h3>
              <p style={{ color: '#64748B', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                NF: <strong>{currentNf.nf}</strong> | Peso Total da NF: <strong>{currentNf.peso_kg} kg</strong>
              </p>
            </div>

            <div className="form-group mb-3">
              <label className="form-label">Quantidade de Caixas Contadas (real)</label>
              <input type="number" className="form-control text-center"
                style={{ fontSize: '1.5rem', fontWeight: 700, padding: '0.75rem', borderRadius: '10px' }}
                placeholder="0" min="0"
                value={shortageQtd}
                onChange={e => setShortageQtd(e.target.value)} />
            </div>

            <div className="form-group mb-3">
              <label className="form-label">Peso da Falta (kg)</label>
              <input type="number" className="form-control text-center"
                style={{ fontSize: '1.5rem', fontWeight: 700, padding: '0.75rem', borderRadius: '10px' }}
                placeholder="0.00" min="0" step="0.01"
                value={shortagePeso}
                onChange={e => setShortagePeso(e.target.value)} />
              <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '0.5rem', textAlign: 'center' }}>
                Peso real carregado = {currentNf.peso_kg} kg − {shortagePeso || 0} kg
                = <strong>{(currentNf.peso_kg - (parseFloat(shortagePeso) || 0)).toFixed(2)} kg</strong>
              </div>
            </div>

            <button className="btn btn-danger w-100" onClick={handleReportShortage}
              style={{ padding: '0.875rem', borderRadius: '12px', fontSize: '1rem', fontWeight: 600 }}>
              Confirmar Falta e Avançar
            </button>
          </div>
        </div>
      )}

      {/* ===== PASSO 3: FOTOS + RESUMO ===== */}
      {step === 3 && (
        <div className="animate-slide-up">
          {/* Resumo das faltas */}
          {nfResults.some(r => r.temFalta) && (
            <div className="card p-3 mb-3 border-0" style={{ borderRadius: '12px', backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
              <div style={{ fontWeight: 700, color: '#92400E', marginBottom: '0.5rem' }}>⚠️ NFs com Falta Registrada</div>
              {nfResults.filter(r => r.temFalta).map(r => (
                <div key={r.deliveryId} style={{ fontSize: '0.875rem', color: '#92400E', marginBottom: '0.25rem' }}>
                  NF {r.nf}: −{r.pesoFaltaKg} kg | Peso real: {r.pesoRealCarregado.toFixed(2)} kg
                </div>
              ))}
            </div>
          )}

          {/* Card de peso total */}
          <div className="card p-3 mb-4 border-0" style={{ borderRadius: '12px', backgroundColor: '#0F3B63' }}>
            <div className="d-flex justify-content-between align-items-center text-white">
              <div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>PESO TOTAL DO CAMINHÃO</div>
                <div style={{ fontWeight: 800, fontSize: '1.5rem' }}>
                  {nfResults.reduce((acc, r) => acc + r.pesoRealCarregado, 0).toFixed(2)} kg
                </div>
              </div>
              <Scale size={32} color="rgba(255,255,255,0.5)" />
            </div>
          </div>

          <div className="card p-4 border-0" style={{ borderRadius: '16px', boxShadow: '0 4px 16px rgba(15,59,99,0.1)' }}>
            <div className="text-center mb-4">
              <CheckCircle color="#27AE60" size={48} style={{ marginBottom: '0.5rem' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F3B63', margin: 0 }}>Conferência Concluída!</h2>
              <p style={{ color: '#64748B', fontSize: '0.875rem', marginTop: '0.25rem' }}>Capture as 3 evidências para finalizar.</p>
            </div>

            <div className="d-flex flex-column" style={{ gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { key: 'mercadoria', label: 'Foto da Mercadoria', sub: 'Visão geral dos paletes', Icon: ImageIcon },
                { key: 'termometro', label: 'Foto da Temperatura', sub: 'Termômetro da carga', Icon: Thermometer },
                { key: 'caminhao', label: 'Foto do Caminhão', sub: 'Traseira / Baú carregado', Icon: Truck },
              ].map(({ key, label, sub, Icon }) => (
                <div key={key} className="d-flex align-items-center justify-content-between p-3"
                  style={{ borderRadius: '10px', border: `2px solid ${photos[key] ? '#27AE60' : '#E2E8F0'}`, backgroundColor: photos[key] ? '#F0FDF4' : 'white' }}>
                  <div className="d-flex align-items-center" style={{ gap: '0.75rem' }}>
                    <Icon size={22} color={photos[key] ? '#27AE60' : '#94A3B8'} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{sub}</div>
                    </div>
                  </div>
                  <button
                    style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: photos[key] ? '#27AE60' : '#E2E8F0', color: photos[key] ? 'white' : '#64748B', fontWeight: 600 }}
                    onClick={() => handlePhotoClick(key)} disabled={uploadingPhotos[key]}>
                    {uploadingPhotos[key] ? '...' : photos[key] ? <CheckCircle size={18} /> : <Camera size={18} />}
                  </button>
                </div>
              ))}
            </div>

            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileChange} />

            <button className="btn btn-primary w-100" disabled={!allPhotosCaptured || loading} onClick={handleFinalize}
              style={{ padding: '1rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 700, opacity: allPhotosCaptured ? 1 : 0.5 }}>
              {loading ? 'Finalizando...' : '🚛 Finalizar Embarque'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 text-center" style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
        CTOE · Módulo Armazém · Conferência Cega
      </div>
    </div>
  );
};

export default WarehouseApp;
