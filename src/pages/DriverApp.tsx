import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, Send, AlertTriangle, Package, Search, MessageCircle, FileText, ChevronLeft, Image as ImageIcon, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Delivery {
  id: string;
  chave_entrega: string;
  data_operacao: string;
  nf: string;
  cliente: string;
  filial: string;
  motorista: string;
  placa: string;
  endereco: string;
  cidade: string;
  manifesto: string;
}

interface Occurrence {
  id: string;
  nf: string | null;
  tipo_ocorrencia: string;
  descricao: string;
  status: string;
  data_abertura: string;
  cliente: string;
  endereco: string;
  cidade: string;
  attachment_urls: string[];
  latitude: number | null;
  longitude: number | null;
}

interface Message {
  id: string;
  occurrence_id: string;
  sender_type: string;
  sender_name: string;
  message: string;
  attachment_url: string | null;
  is_read: boolean;
  created_at: string;
}

const photoRequiredTypes = [
  'Avaria', 'Falta de produto', 'Falta de peso', 'Recusa parcial', 
  'Recusa total', 'Sinistro', 'Mercadoria avariada', 'Mercadoria faltante', 'Cliente fechado' // Added just in case
];

const DriverApp: React.FC = () => {
  const [authPlaca, setAuthPlaca] = useState('');
  const [authManifesto, setAuthManifesto] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [myOccurrences, setMyOccurrences] = useState<Occurrence[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  const [activeTab, setActiveTab] = useState<'manifesto' | 'ocorrencias' | 'chats' | 'abrir_ocorrencia'>('manifesto');
  const [nfSearch, setNfSearch] = useState('');
  const [selectedNFs, setSelectedNFs] = useState<string[]>([]);
  
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ tipo: '', descricao: '' });
  
  // Attachments and Geolocation
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [chatPhoto, setChatPhoto] = useState<File | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  const motoristaNome = deliveries.length > 0 ? deliveries[0].motorista : '';
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<any>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('deliveries')
      .select('*')
      .eq('placa', authPlaca.toUpperCase())
      .eq('manifesto', authManifesto)
      .eq('data_operacao', today);
      
    if (error) {
      alert('Erro: ' + error.message);
    } else if (data && data.length > 0) {
      setDeliveries(data);
      setIsAuthenticated(true);
      fetchMyOccurrences();
    } else {
      alert('Manifesto ou placa não encontrados para a operação de hoje.');
    }
    setLoading(false);
  };

  const playChatSound = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(600, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.15);
    } catch (e) { console.error('Audio falhou', e); }
  };

  const fetchMyOccurrences = async () => {
    const { data } = await supabase
      .from('occurrences')
      .select('id, nf, tipo_ocorrencia, descricao, status, data_abertura, cliente, endereco, cidade, attachment_urls, latitude, longitude')
      .eq('placa', authPlaca.toUpperCase())
      .eq('manifesto', authManifesto)
      .order('data_abertura', { ascending: false });
    if (data) {
      setMyOccurrences(data);
      fetchUnreadCounts(data.map(o => o.id));
    }
  };

  const fetchUnreadCounts = async (occurrenceIds: string[]) => {
    if (occurrenceIds.length === 0) return;
    const { data } = await supabase
      .from('occurrence_messages')
      .select('occurrence_id, is_read, sender_type')
      .in('occurrence_id', occurrenceIds)
      .eq('is_read', false)
      .eq('sender_type', 'monitor');
      
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach(msg => {
        counts[msg.occurrence_id] = (counts[msg.occurrence_id] || 0) + 1;
      });
      setUnreadCounts(counts);
    }
  };

  const markChatAsRead = async (occurrenceId: string) => {
    await supabase.from('occurrence_messages')
      .update({ is_read: true })
      .eq('occurrence_id', occurrenceId)
      .eq('sender_type', 'monitor')
      .eq('is_read', false);
      
    setUnreadCounts(prev => ({ ...prev, [occurrenceId]: 0 }));
  };

  const loadChat = async (occurrenceId: string) => {
    setActiveChat(occurrenceId);
    setActiveTab('chats');
    markChatAsRead(occurrenceId);
    
    const { data } = await supabase
      .from('occurrence_messages')
      .select('*')
      .eq('occurrence_id', occurrenceId)
      .order('created_at', { ascending: true });
    if (data) {
      setChatMessages(data);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const uploadFile = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error } = await supabase.storage.from('ctoe-attachments').upload(fileName, file);
    if (error) throw error;
    const { data: publicUrlData } = supabase.storage.from('ctoe-attachments').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || loading) return;
    if (!newMessage.trim() && !chatPhoto) return;
    
    setLoading(true);
    let attachmentUrl = null;

    try {
      if (chatPhoto) {
        attachmentUrl = await uploadFile(chatPhoto);
      }
      
      await supabase.from('occurrence_messages').insert([{
        occurrence_id: activeChat,
        sender_type: 'motorista',
        sender_name: motoristaNome || 'Motorista',
        message: newMessage,
        attachment_url: attachmentUrl,
        is_read: false
      }]);
      
      setNewMessage('');
      setChatPhoto(null);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      alert('Erro ao enviar mensagem: ' + err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    const sub = supabase.channel('chat_driver_global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'occurrence_messages' }, payload => {
        const msg = payload.new as Message;
        if (msg.sender_type === 'monitor') {
          if (activeChat === msg.occurrence_id) {
            setChatMessages(prev => [...prev, msg]);
            markChatAsRead(msg.occurrence_id);
            playChatSound();
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          } else {
            setUnreadCounts(prev => ({ ...prev, [msg.occurrence_id]: (prev[msg.occurrence_id] || 0) + 1 }));
            playChatSound();
          }
        }
      }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [activeChat]);

  const toggleNF = (nf: string) => {
    setSelectedNFs(prev => prev.includes(nf) ? prev.filter(n => n !== nf) : [...prev, nf]);
  };

  const toggleAllNFs = () => {
    if (selectedNFs.length === deliveries.length) setSelectedNFs([]);
    else setSelectedNFs(deliveries.map(d => d.nf));
  };

  const getGeolocation = (): Promise<{ lat: number, lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada neste navegador.'));
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
          () => reject(new Error('Permissão de localização negada ou falha na captura.')),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    });
  };

  const handleSubmitOccurrence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedNFs.length === 0) {
      alert('Selecione pelo menos uma NF ou o Manifesto Inteiro.');
      return;
    }
    
    if (photoRequiredTypes.includes(formData.tipo) && selectedPhotos.length === 0) {
      alert(`Para ocorrência de "${formData.tipo}", é OBRIGATÓRIO anexar foto.`);
      return;
    }
    
    setLoading(true);
    let coords = null;
    
    try {
      coords = await getGeolocation();
    } catch (err: any) {
      alert('Para abrir uma ocorrência é obrigatório permitir acesso à localização.\n' + err.message);
      setLoading(false);
      return;
    }

    try {
      const uploadedUrls: string[] = [];
      for (const photo of selectedPhotos) {
        const url = await uploadFile(photo);
        uploadedUrls.push(url);
      }

      const isManifestoInteiro = selectedNFs.length === deliveries.length;
      const nfString = isManifestoInteiro ? 'MANIFESTO INTEIRO' : selectedNFs.join(', ');
      const targetDelivery = deliveries.find(d => d.nf === selectedNFs[0]) || deliveries[0];

      const { error, data } = await supabase
        .from('occurrences')
        .insert([{
          delivery_id: targetDelivery.id,
          placa: authPlaca.toUpperCase(),
          manifesto: authManifesto,
          motorista: motoristaNome,
          filial: targetDelivery.filial,
          nf: nfString,
          cliente: isManifestoInteiro ? 'Múltiplos Clientes' : targetDelivery.cliente,
          endereco: isManifestoInteiro ? 'Múltiplos Endereços' : targetDelivery.endereco,
          cidade: targetDelivery.cidade,
          tipo_ocorrencia: formData.tipo,
          descricao: formData.descricao,
          status: 'Nova',
          criticidade: ['Avaria', 'Sinistro', 'Roubo'].includes(formData.tipo) ? 'Alta' : 'Normal',
          criado_por_tipo: 'motorista',
          criado_por_nome: motoristaNome,
          data_operacao: new Date().toISOString().split('T')[0],
          latitude: coords.lat,
          longitude: coords.lng,
          attachment_urls: uploadedUrls
        }]).select();

      if (error) throw error;

      if (data && data[0]) {
         await supabase.from('occurrence_history').insert([{
           occurrence_id: data[0].id,
           acao: 'Abertura de Ocorrência',
           status_novo: 'Nova',
           responsavel: motoristaNome
         }]);
      }
      alert('Ocorrência enviada! A Central Operacional foi notificada.');
      setFormData({ tipo: '', descricao: '' });
      setSelectedNFs([]);
      setSelectedPhotos([]);
      setActiveTab('ocorrencias');
      fetchMyOccurrences();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
    
    setLoading(false);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files);
      setSelectedPhotos(prev => [...prev, ...filesArr]);
    }
  };

  const removeSelectedPhoto = (index: number) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const filteredDeliveries = deliveries.filter(d => 
    d.nf.includes(nfSearch) || d.cliente.toLowerCase().includes(nfSearch.toLowerCase())
  );

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isAuthenticated) {
    return (
      <div style={{ backgroundColor: 'var(--color-bg-main)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div className="card animate-slide-up" style={{ padding: '2.5rem', width: '100%', maxWidth: '420px', borderRadius: 'var(--radius-xl)' }}>
          <div className="text-center mb-4">
            <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--color-primary-pale)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <Package size={40} color="var(--color-primary)" />
            </div>
            <h1 style={{ color: 'var(--color-primary)', fontSize: '1.5rem', fontWeight: 700 }}>CTOE Operacional</h1>
            <p className="text-secondary text-sm mt-2">Central de Ocorrências Logísticas</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Placa do Veículo</label>
              <input type="text" className="form-control" placeholder="Ex: ABC-1234" value={authPlaca} onChange={e => setAuthPlaca(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Número do Manifesto</label>
              <input type="text" className="form-control" placeholder="Ex: 998877" value={authManifesto} onChange={e => setAuthManifesto(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary w-100 mt-2" style={{ padding: '0.875rem', fontSize: '1rem', borderRadius: 'var(--radius-md)' }} disabled={loading}>
              {loading ? 'Validando...' : 'Acessar Operação'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <div style={{ backgroundColor: 'var(--color-bg-main)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ backgroundColor: 'var(--color-primary)', color: 'white', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 10, boxShadow: 'var(--shadow-md)' }}>
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>Placa: {authPlaca.toUpperCase()}</h2>
            <div className="text-sm" style={{ color: 'var(--color-primary-pale)' }}>Man: {authManifesto} | {motoristaNome}</div>
          </div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600 }}>
            Online
          </div>
        </div>
      </header>

      <div className="d-flex" style={{ backgroundColor: 'white', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: '72px', zIndex: 9 }}>
        <button className="btn w-100 d-flex flex-column align-items-center" style={{ borderRadius: 0, borderBottom: activeTab === 'manifesto' || activeTab === 'abrir_ocorrencia' ? '3px solid var(--color-primary)' : '3px solid transparent', color: activeTab === 'manifesto' || activeTab === 'abrir_ocorrencia' ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: activeTab === 'manifesto' || activeTab === 'abrir_ocorrencia' ? 600 : 500, padding: '1rem 0' }} onClick={() => setActiveTab('manifesto')}>
          <FileText size={20} className="mb-1" />
          <span style={{ fontSize: '0.75rem' }}>Manifesto</span>
        </button>
        <button className="btn w-100 d-flex flex-column align-items-center" style={{ borderRadius: 0, borderBottom: activeTab === 'ocorrencias' ? '3px solid var(--color-primary)' : '3px solid transparent', color: activeTab === 'ocorrencias' ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: activeTab === 'ocorrencias' ? 600 : 500, padding: '1rem 0' }} onClick={() => { setActiveTab('ocorrencias'); fetchMyOccurrences(); }}>
          <AlertTriangle size={20} className="mb-1" />
          <span style={{ fontSize: '0.75rem' }}>Ocorrências</span>
        </button>
        <button className="btn w-100 d-flex flex-column align-items-center position-relative" style={{ borderRadius: 0, borderBottom: activeTab === 'chats' ? '3px solid var(--color-primary)' : '3px solid transparent', color: activeTab === 'chats' ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: activeTab === 'chats' ? 600 : 500, padding: '1rem 0' }} onClick={() => { setActiveChat(null); setActiveTab('chats'); fetchMyOccurrences(); }}>
          {totalUnread > 0 && (
            <span style={{ position: 'absolute', top: '0.5rem', right: '1.5rem', backgroundColor: 'var(--color-danger)', color: 'white', borderRadius: '10px', padding: '0.1rem 0.4rem', fontSize: '0.65rem', fontWeight: 'bold' }}>
              {totalUnread}
            </span>
          )}
          <MessageCircle size={20} className="mb-1" />
          <span style={{ fontSize: '0.75rem' }}>Chats</span>
        </button>
      </div>

      <div className="p-3 flex-grow-1 animate-fade-in" style={{ paddingBottom: '5rem' }}>
        
        {activeTab === 'manifesto' && (
          <div>
            <div className="card mb-3 p-4 text-center bg-white border-0" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <div className="text-secondary text-sm mb-1">Total de NFs no Manifesto</div>
              <h2 style={{ fontSize: '2rem', color: 'var(--color-primary)', margin: 0 }}>{deliveries.length}</h2>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-3 px-1">
              <h4 style={{ margin: 0, fontWeight: 600, color: 'var(--color-primary-dark)' }}>Relação de Notas</h4>
              <button className="btn btn-secondary text-sm" style={{ padding: '0.25rem 0.75rem' }} onClick={toggleAllNFs}>
                {selectedNFs.length === deliveries.length ? 'Desmarcar Tudo' : 'Selecionar Tudo'}
              </button>
            </div>

            <div className="form-group mb-3 position-relative">
              <Search size={18} className="text-muted position-absolute" style={{ left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input type="text" className="form-control" placeholder="Pesquisar NF ou Cliente..." value={nfSearch} onChange={e => setNfSearch(e.target.value)} style={{ paddingLeft: '2.75rem', borderRadius: 'var(--radius-full)' }} />
            </div>

            <div className="d-flex flex-column" style={{ gap: '0.75rem' }}>
              {filteredDeliveries.map(d => (
                <div key={d.id} className="card p-3 d-flex align-items-center bg-white border-0 card-hover" style={{ gap: '1rem', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }} onClick={() => toggleNF(d.nf)}>
                  <input type="checkbox" className="custom-checkbox m-0" checked={selectedNFs.includes(d.nf)} readOnly />
                  <div className="flex-grow-1">
                    <strong className="d-block mb-1" style={{ color: 'var(--color-primary-dark)', fontSize: '1rem' }}>NF: {d.nf}</strong>
                    <div className="text-secondary text-sm mb-1"><span className="font-weight-bold">Cliente:</span> {d.cliente}</div>
                    <div className="text-secondary text-xs"><span className="font-weight-bold">Destino:</span> {d.endereco}, {d.cidade}</div>
                  </div>
                </div>
              ))}
            </div>

            {selectedNFs.length > 0 && (
              <div style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', right: '1.5rem', zIndex: 20 }}>
                <button className="btn btn-primary w-100 shadow-float" style={{ padding: '1rem', borderRadius: 'var(--radius-xl)', fontSize: '1.1rem', boxShadow: 'var(--shadow-lg)' }} onClick={() => setActiveTab('abrir_ocorrencia')}>
                  <AlertTriangle size={20} className="mr-2" /> 
                  Relatar Problema ({selectedNFs.length} NFs)
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'abrir_ocorrencia' && (
          <div className="card p-4 bg-white border-0 animate-slide-up" style={{ boxShadow: 'var(--shadow-md)', borderRadius: 'var(--radius-lg)' }}>
            <div className="d-flex align-items-center mb-4 pb-3 border-bottom" style={{ gap: '0.75rem' }}>
              <button className="btn p-1 text-secondary bg-transparent border-0" onClick={() => setActiveTab('manifesto')}><ChevronLeft size={24}/></button>
              <h3 style={{ margin: 0, color: 'var(--color-primary-dark)', fontWeight: 600 }}>Nova Ocorrência</h3>
            </div>
            
            <div className="mb-4 p-3 rounded" style={{ backgroundColor: 'var(--color-info-bg)' }}>
              <div className="text-sm font-weight-bold" style={{ color: 'var(--color-primary)' }}>NFs Selecionadas:</div>
              <div className="text-sm mt-1">{selectedNFs.length === deliveries.length ? 'Manifesto Completo' : selectedNFs.join(', ')}</div>
            </div>
            
            <form onSubmit={handleSubmitOccurrence}>
              <div className="form-group">
                <label className="form-label">Tipo de Ocorrência</label>
                <select className="form-control" style={{ padding: '0.75rem' }} value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} required>
                  <option value="">Selecione...</option>
                  <option value="Cliente fechado">Cliente fechado</option>
                  <option value="Demora na descarga">Demora na descarga</option>
                  <option value="Recusa total">Recusa total</option>
                  <option value="Recusa parcial">Recusa parcial</option>
                  <option value="Falta de produto">Falta de produto</option>
                  <option value="Falta de peso">Falta de peso</option>
                  <option value="Avaria">Avaria</option>
                  <option value="Sinistro">Sinistro</option>
                  <option value="Endereço incorreto">Endereço incorreto</option>
                  <option value="Dificuldade de acesso">Dificuldade de acesso</option>
                  <option value="Problema documental">Problema documental</option>
                  <option value="Divergência de pedido">Divergência de pedido</option>
                  <option value="Outros">Outros</option>
                </select>
                {photoRequiredTypes.includes(formData.tipo) && (
                  <div className="text-xs text-danger mt-1 font-weight-bold d-flex align-items-center gap-1">
                    <AlertTriangle size={12}/> Foto obrigatória para este tipo.
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Descrição</label>
                <textarea className="form-control" rows={4} value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} placeholder="Descreva os detalhes operacionais..." required></textarea>
              </div>
              
              <div className="form-label mt-4 mb-2">Anexos Operacionais</div>
              
              {selectedPhotos.length > 0 && (
                <div className="d-flex gap-2 mb-3 overflow-auto pb-2">
                  {selectedPhotos.map((photo, i) => (
                    <div key={i} className="position-relative" style={{ minWidth: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                      <img src={URL.createObjectURL(photo)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" onClick={() => removeSelectedPhoto(i)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', padding: '2px', cursor: 'pointer' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input type="file" accept="image/*" multiple style={{ display: 'none' }} ref={fileInputRef} onChange={handlePhotoSelect} />
              
              <div className="d-flex mb-4" style={{ gap: '0.75rem' }}>
                <button type="button" className="btn btn-outline w-100 flex-column py-3" style={{ color: 'var(--color-secondary)' }} onClick={() => fileInputRef.current?.click()}>
                  <Camera size={24} className="mb-2" />
                  <span className="text-sm">Tirar/Anexar Foto</span>
                </button>
                <button type="button" className="btn btn-outline w-100 flex-column py-3 position-relative" style={{ color: 'var(--color-secondary)' }} disabled>
                  <MapPin size={24} className="mb-2 text-success" />
                  <span className="text-sm">Auto-GPS Ativo</span>
                  <div style={{ position: 'absolute', top: -5, right: -5, width: 12, height: 12, backgroundColor: 'var(--color-success)', borderRadius: '50%', border: '2px solid white' }}></div>
                </button>
              </div>

              <button type="submit" className="btn btn-primary w-100 mt-2" disabled={loading} style={{ padding: '1rem', fontSize: '1.1rem', borderRadius: 'var(--radius-xl)' }}>
                {loading ? 'Processando e Enviando...' : 'Confirmar Ocorrência'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'ocorrencias' && (
          <div className="d-flex flex-column" style={{ gap: '1rem' }}>
            {myOccurrences.length === 0 && (
              <div className="text-center p-5 text-muted">
                <AlertTriangle size={48} className="mb-3 opacity-50 mx-auto d-block" />
                <p>Nenhuma ocorrência operada neste manifesto.</p>
              </div>
            )}
            {myOccurrences.map(o => (
              <div key={o.id} className="card p-4 bg-white border-0" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-lg)' }}>
                <div className="d-flex justify-content-between mb-3 align-items-start">
                  <div>
                    <strong className="d-block mb-1" style={{ fontSize: '1.1rem', color: 'var(--color-primary-dark)' }}>{o.tipo_ocorrencia}</strong>
                    <span className="text-xs text-muted d-block">{formatTime(o.data_abertura)} - {new Date(o.data_abertura).toLocaleDateString()}</span>
                  </div>
                  <span className={`badge ${o.status === 'Nova' ? 'badge-danger' : o.status === 'Resolvida' ? 'badge-success' : 'badge-warning'}`} style={{ padding: '0.4rem 0.8rem' }}>{o.status}</span>
                </div>
                
                <div className="text-secondary text-sm mb-3">{o.descricao}</div>

                {o.attachment_urls && o.attachment_urls.length > 0 && (
                  <div className="d-flex gap-2 mb-3 overflow-auto">
                    {o.attachment_urls.map((url, i) => (
                      <img key={i} src={url} alt="Anexo" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--color-border)', cursor: 'pointer' }} onClick={() => setFullScreenImage(url)} />
                    ))}
                  </div>
                )}

                <div className="text-secondary text-sm p-3 rounded" style={{ backgroundColor: 'var(--color-bg-main)' }}>
                  <div className="mb-1"><span className="font-weight-bold">NF(s):</span> {o.nf === 'MANIFESTO INTEIRO' ? 'Manifesto Completo' : o.nf}</div>
                  <div className="mb-1"><span className="font-weight-bold">Cliente:</span> {o.cliente}</div>
                  <div><span className="font-weight-bold">Destino:</span> {o.endereco}, {o.cidade}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'chats' && !activeChat && (
          <div className="d-flex flex-column" style={{ gap: '0.75rem' }}>
            {myOccurrences.length === 0 && <p className="text-center text-muted p-5">Nenhum chat disponível.</p>}
            {myOccurrences.map(o => {
              const unread = unreadCounts[o.id] || 0;
              return (
                <div key={o.id} className="card p-3 d-flex align-items-center border-0 card-hover" onClick={() => loadChat(o.id)} style={{ cursor: 'pointer', boxShadow: 'var(--shadow-sm)', gap: '1rem', backgroundColor: unread > 0 ? 'var(--color-info-bg)' : 'white', borderLeft: unread > 0 ? '4px solid var(--color-primary)' : '4px solid transparent' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: unread > 0 ? 'var(--color-primary)' : 'var(--color-primary-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle size={24} color={unread > 0 ? 'white' : 'var(--color-primary)'} />
                  </div>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <strong style={{ color: 'var(--color-primary-dark)', fontSize: '1rem' }}>Central Operacional</strong>
                      <span className="text-xs text-muted">{formatTime(o.data_abertura)}</span>
                    </div>
                    <div className="text-secondary text-sm text-truncate d-block">Ref: {o.tipo_ocorrencia}</div>
                  </div>
                  {unread > 0 && <div className="badge badge-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: '24px', height: '24px', padding: 0 }}>{unread}</div>}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'chats' && activeChat && (
          <div className="d-flex flex-column" style={{ height: 'calc(100vh - 150px)', margin: '-1rem' }}>
            <div className="p-3 border-bottom d-flex align-items-center" style={{ backgroundColor: 'white', zIndex: 2, gap: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <button className="btn p-1 text-secondary bg-transparent border-0" onClick={() => setActiveChat(null)}><ChevronLeft size={24}/></button>
              <div>
                <strong className="d-block" style={{ color: 'var(--color-primary-dark)', fontSize: '1.1rem' }}>Central Operacional</strong>
                <span className="text-xs text-success">Online</span>
              </div>
            </div>
            
            <div className="flex-grow-1 p-3 d-flex flex-column" style={{ overflowY: 'auto', gap: '1rem', backgroundColor: '#efeae2' }}>
              {chatMessages.length === 0 && <p className="text-center text-muted mt-4 text-sm">Inicie a conversa com a Central.</p>}
              {chatMessages.map(m => {
                const isDriver = m.sender_type === 'motorista';
                return (
                  <div key={m.id} style={{ 
                    alignSelf: isDriver ? 'flex-end' : 'flex-start', 
                    maxWidth: '85%', 
                    padding: '0.6rem 1rem', 
                    borderRadius: isDriver ? '1rem 1rem 0 1rem' : '1rem 1rem 1rem 0', 
                    backgroundColor: isDriver ? '#e2f7cb' : 'white', 
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)' 
                  }}>
                    {!isDriver && <div className="text-xs font-weight-bold mb-1" style={{ color: 'var(--color-primary)' }}>{m.sender_name} (Monitor)</div>}
                    {m.attachment_url && (
                      <div className="mb-2">
                        <img src={m.attachment_url} alt="Anexo" style={{ width: '100%', borderRadius: '8px', cursor: 'pointer' }} onClick={() => setFullScreenImage(m.attachment_url!)} />
                      </div>
                    )}
                    <div style={{ color: '#303030', fontSize: '0.95rem', wordBreak: 'break-word' }}>{m.message}</div>
                    <div className="text-right mt-1" style={{ fontSize: '0.65rem', color: 'gray' }}>{formatTime(m.created_at)}</div>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>
            
            {chatPhoto && (
              <div className="p-2 bg-light border-top d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <ImageIcon size={18} className="text-primary"/>
                  <span className="text-sm font-weight-bold text-primary text-truncate" style={{ maxWidth: '200px' }}>{chatPhoto.name}</span>
                </div>
                <button type="button" className="btn p-1 text-danger border-0 bg-transparent" onClick={() => setChatPhoto(null)}><X size={18}/></button>
              </div>
            )}

            <form onSubmit={sendMessage} className="p-2 d-flex align-items-center bg-white" style={{ gap: '0.5rem' }}>
              <input type="file" accept="image/*" style={{ display: 'none' }} ref={chatFileInputRef} onChange={e => { if (e.target.files && e.target.files[0]) setChatPhoto(e.target.files[0]) }} />
              <button type="button" className="btn p-2 text-secondary bg-transparent border-0" onClick={() => chatFileInputRef.current?.click()}><ImageIcon size={24}/></button>
              <input type="text" className="form-control" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Mensagem" style={{ borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-bg-main)', border: 'none', padding: '0.75rem 1.25rem' }} />
              <button type="submit" className="btn p-2 rounded-circle" style={{ backgroundColor: 'var(--color-primary)', color: 'white', minWidth: '44px', height: '44px' }} disabled={loading || (!newMessage.trim() && !chatPhoto)}>
                <Send size={20} style={{ marginLeft: '2px' }} />
              </button>
            </form>
          </div>
        )}
      </div>

      {fullScreenImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setFullScreenImage(null)}>
          <button className="btn bg-transparent border-0 text-white position-absolute" style={{ top: '1rem', right: '1rem' }} onClick={() => setFullScreenImage(null)}>
            <X size={32} />
          </button>
          <img src={fullScreenImage} alt="Fullscreen" style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain' }} />
        </div>
      )}

    </div>
  );
};

export default DriverApp;
