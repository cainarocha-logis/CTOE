import React, { useState, useRef } from 'react';
import { Package, Truck, Camera, CheckCircle, AlertCircle, ArrowRight, ShieldCheck, Thermometer, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Delivery {
  id: string;
  nf: string;
  cliente: string;
  placa: string;
  manifesto: string;
  qtd_caixas: number;
}

const WarehouseApp: React.FC = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Authentication
  const [authPlaca, setAuthPlaca] = useState('');
  const [authManifesto, setAuthManifesto] = useState('');
  const [manifestoDeliveries, setManifestoDeliveries] = useState<Delivery[]>([]);

  // Step 2: Blind Counting
  const [currentNfIndex, setCurrentNfIndex] = useState(0);
  const [countingValue, setCountingValue] = useState('');

  // Step 3: Photos
  const [photos, setPhotos] = useState<{ [key: string]: string | null }>({
    mercadoria: null,
    termometro: null,
    caminhao: null
  });
  const [uploadingPhotos, setUploadingPhotos] = useState<{ [key: string]: boolean }>({
    mercadoria: false,
    termometro: false,
    caminhao: false
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePhotoType, setActivePhotoType] = useState<string | null>(null);

  const resetState = () => {
    setStep(1);
    setAuthPlaca('');
    setAuthManifesto('');
    setManifestoDeliveries([]);
    setCurrentNfIndex(0);
    setCountingValue('');
    setPhotos({ mercadoria: null, termometro: null, caminhao: null });
    setError(null);
  };

  const handleStartConference = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: dbError } = await supabase
      .from('deliveries')
      .select('id, nf, cliente, placa, manifesto, qtd_caixas')
      .eq('placa', authPlaca.toUpperCase())
      .eq('manifesto', authManifesto)
      .eq('status_conferencia', 'Pendente');

    if (dbError) {
      setError('Erro ao consultar banco de dados: ' + dbError.message);
    } else if (!data || data.length === 0) {
      setError('Manifesto ou placa não encontrados, ou carga já conferida.');
    } else {
      setManifestoDeliveries(data);
      setStep(2);
    }
    setLoading(false);
  };

  const handleConfirmCount = () => {
    const currentNf = manifestoDeliveries[currentNfIndex];
    const count = parseInt(countingValue);

    if (isNaN(count) || count !== currentNf.qtd_caixas) {
      setError('Quantidade incorreta. Reconte as caixas.');
      setCountingValue('');
      return;
    }

    setError(null);
    setCountingValue('');

    if (currentNfIndex < manifestoDeliveries.length - 1) {
      setCurrentNfIndex(currentNfIndex + 1);
    } else {
      setStep(3);
    }
  };

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
      
      const { error: uploadError } = await supabase.storage
        .from('ctoe-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('ctoe-attachments')
        .getPublicUrl(fileName);

      setPhotos(prev => ({ ...prev, [activePhotoType]: publicUrl.publicUrl }));
    } catch (err: any) {
      alert('Erro no upload: ' + err.message);
    } finally {
      setUploadingPhotos(prev => ({ ...prev, [activePhotoType]: false }));
      setActivePhotoType(null);
    }
  };

  const handleFinalize = async () => {
    setLoading(true);
    const photoUrls = [photos.mercadoria, photos.termometro, photos.caminhao];

    try {
      const { error: updateError } = await supabase
        .from('deliveries')
        .update({
          status_conferencia: 'Conferido',
          status_entrega: 'Liberado para Rota',
          fotos_embarque: photoUrls
        })
        .eq('manifesto', authManifesto)
        .eq('placa', authPlaca.toUpperCase());

      if (updateError) throw updateError;

      alert('Embarque Finalizado com Sucesso! Carga liberada para rota.');
      resetState();
    } catch (err: any) {
      alert('Erro ao finalizar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const allPhotosCaptured = photos.mercadoria && photos.termometro && photos.caminhao;

  return (
    <div style={{ backgroundColor: '#F5F7FA', minHeight: '100vh', padding: '1rem' }}>
      {/* Header */}
      <div className="mb-4 d-flex align-items-center" style={{ gap: '1rem' }}>
        <div style={{ backgroundColor: '#0F3B63', padding: '0.75rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(15, 59, 99, 0.2)' }}>
          <Truck color="white" size={28} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0F3B63' }}>CTOE | Módulo Armazém</h1>
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>CONTROLE DE EMBARQUE E CONFERÊNCIA</div>
        </div>
      </div>

      {/* Step 1: Login */}
      {step === 1 && (
        <div className="card p-4 border-0 shadow-sm animate-slide-up" style={{ borderRadius: '16px' }}>
          <h3 className="mb-4 d-flex align-items-center" style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1E293B', gap: '0.5rem' }}>
            <ShieldCheck size={20} className="text-primary" /> Iniciar Nova Carga
          </h3>
          <form onSubmit={handleStartConference}>
            <div className="form-group mb-3">
              <label className="form-label">Placa do Veículo</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="ABC1234" 
                value={authPlaca} 
                onChange={e => setAuthPlaca(e.target.value.toUpperCase())}
                required 
                style={{ textTransform: 'uppercase', padding: '0.75rem' }}
              />
            </div>
            <div className="form-group mb-4">
              <label className="form-label">Número do Manifesto</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="000000" 
                value={authManifesto} 
                onChange={e => setAuthManifesto(e.target.value)}
                required 
                style={{ padding: '0.75rem' }}
              />
            </div>
            {error && (
              <div className="alert alert-danger p-2 mb-4 d-flex align-items-center text-sm" style={{ gap: '0.5rem', borderRadius: '8px' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary w-100 p-3" disabled={loading} style={{ borderRadius: '12px', fontSize: '1rem', fontWeight: 600 }}>
              {loading ? 'Validando...' : 'Iniciar Conferência'}
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Blind Count */}
      {step === 2 && (
        <div className="card p-4 border-0 shadow-sm animate-slide-up" style={{ borderRadius: '16px' }}>
          <div className="text-center mb-4">
            <div className="badge badge-info mb-2">NF {currentNfIndex + 1} de {manifestoDeliveries.length}</div>
            <div style={{ fontSize: '0.875rem', color: '#64748B' }}>Conferindo nota fiscal:</div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F3B63', margin: '0.5rem 0' }}>
              {manifestoDeliveries[currentNfIndex].nf}
            </h2>
          </div>

          <div className="p-4 bg-light rounded-lg mb-4 text-center" style={{ border: '2px dashed #CBD5E1' }}>
            <Package size={48} className="text-muted mb-3 mx-auto" />
            <div className="form-group">
              <label className="form-label">Quantidade de Caixas Contadas</label>
              <input 
                type="number" 
                className="form-control text-center" 
                style={{ fontSize: '1.5rem', fontWeight: 700, padding: '1rem' }}
                placeholder="0"
                value={countingValue}
                onChange={e => setCountingValue(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="alert alert-danger p-3 mb-4 d-flex align-items-center text-sm" style={{ gap: '0.5rem', borderRadius: '8px', backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', color: '#991B1B' }}>
              <AlertCircle size={20} /> <span className="font-weight-bold">{error}</span>
            </div>
          )}

          <button className="btn btn-primary w-100 p-3" onClick={handleConfirmCount} style={{ borderRadius: '12px', fontSize: '1.1rem', fontWeight: 600 }}>
            Confirmar e Próxima <ArrowRight size={20} className="ml-2" />
          </button>
        </div>
      )}

      {/* Step 3: Evidence Photos */}
      {step === 3 && (
        <div className="card p-4 border-0 shadow-sm animate-slide-up" style={{ borderRadius: '16px' }}>
          <div className="text-center mb-4">
            <CheckCircle color="#27AE60" size={48} className="mb-2 mx-auto" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F3B63' }}>Conferência Finalizada!</h2>
            <p className="text-secondary text-sm">Agora, capture as evidências de embarque.</p>
          </div>

          <div className="d-flex flex-column" style={{ gap: '1rem' }}>
            {/* Photo 1: Cargo */}
            <div className="p-3 border rounded-lg d-flex align-items-center justify-content-between" style={{ backgroundColor: photos.mercadoria ? '#F0FDF4' : 'white', borderColor: photos.mercadoria ? '#27AE60' : '#E2E8F0' }}>
              <div className="d-flex align-items-center" style={{ gap: '0.75rem' }}>
                <ImageIcon size={24} className={photos.mercadoria ? 'text-success' : 'text-muted'} />
                <div>
                  <div className="font-weight-bold text-sm">Foto da Mercadoria</div>
                  <div className="text-xs text-muted">Visão geral dos paletes</div>
                </div>
              </div>
              <button className={`btn ${photos.mercadoria ? 'btn-success' : 'btn-outline-primary'} btn-sm p-2`} onClick={() => handlePhotoClick('mercadoria')} disabled={uploadingPhotos.mercadoria}>
                {uploadingPhotos.mercadoria ? '...' : photos.mercadoria ? <CheckCircle size={18}/> : <Camera size={18}/>}
              </button>
            </div>

            {/* Photo 2: Thermometer */}
            <div className="p-3 border rounded-lg d-flex align-items-center justify-content-between" style={{ backgroundColor: photos.termometro ? '#F0FDF4' : 'white', borderColor: photos.termometro ? '#27AE60' : '#E2E8F0' }}>
              <div className="d-flex align-items-center" style={{ gap: '0.75rem' }}>
                <Thermometer size={24} className={photos.termometro ? 'text-success' : 'text-muted'} />
                <div>
                  <div className="font-weight-bold text-sm">Foto da Temperatura</div>
                  <div className="text-xs text-muted">Termômetro da carga</div>
                </div>
              </div>
              <button className={`btn ${photos.termometro ? 'btn-success' : 'btn-outline-primary'} btn-sm p-2`} onClick={() => handlePhotoClick('termometro')} disabled={uploadingPhotos.termometro}>
                {uploadingPhotos.termometro ? '...' : photos.termometro ? <CheckCircle size={18}/> : <Camera size={18}/>}
              </button>
            </div>

            {/* Photo 3: Truck */}
            <div className="p-3 border rounded-lg d-flex align-items-center justify-content-between" style={{ backgroundColor: photos.caminhao ? '#F0FDF4' : 'white', borderColor: photos.caminhao ? '#27AE60' : '#E2E8F0' }}>
              <div className="d-flex align-items-center" style={{ gap: '0.75rem' }}>
                <Truck size={24} className={photos.caminhao ? 'text-success' : 'text-muted'} />
                <div>
                  <div className="font-weight-bold text-sm">Foto do Caminhão</div>
                  <div className="text-xs text-muted">Traseira / Baú carregado</div>
                </div>
              </div>
              <button className={`btn ${photos.caminhao ? 'btn-success' : 'btn-outline-primary'} btn-sm p-2`} onClick={() => handlePhotoClick('caminhao')} disabled={uploadingPhotos.caminhao}>
                {uploadingPhotos.caminhao ? '...' : photos.caminhao ? <CheckCircle size={18}/> : <Camera size={18}/>}
              </button>
            </div>
          </div>

          <input type="file" accept="image/*" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileChange} />

          <div className="mt-5">
            <button className="btn btn-primary w-100 p-3" disabled={!allPhotosCaptured || loading} onClick={handleFinalize} style={{ borderRadius: '12px', fontSize: '1.1rem', fontWeight: 700, backgroundColor: allPhotosCaptured ? '#0F3B63' : '#94A3B8' }}>
              {loading ? 'Finalizando...' : 'Finalizar Embarque'}
            </button>
          </div>
        </div>
      )}

      {/* Simple Footer/Info */}
      <div className="mt-4 text-center text-xs text-muted">
        CTOE - Central de Tratativas de Ocorrências de Entrega <br/>
        Ambiente Seguro de Logística
      </div>
    </div>
  );
};

export default WarehouseApp;
