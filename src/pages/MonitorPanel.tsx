import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle, MessageCircle, Search, X, Send, Clock, AlertTriangle, FileText, ChevronRight, CornerUpRight, RefreshCw, XCircle, MapPin, Image as ImageIcon, Kanban, Archive, Menu } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Occurrence {
  id: string;
  nf: string | null;
  placa: string;
  manifesto: string;
  motorista: string;
  cliente: string;
  endereco: string;
  cidade: string;
  tipo_ocorrencia: string;
  descricao: string;
  status: string;
  criticidade: string;
  data_abertura: string;
  responsavel_atual: string;
  latitude: number | null;
  longitude: number | null;
  attachment_urls: string[];
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

interface HistoryItem {
  id: string;
  acao: string;
  status_anterior: string;
  status_novo: string;
  responsavel: string;
  created_at: string;
}

const MonitorPanel: React.FC = () => {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [activeOccurrence, setActiveOccurrence] = useState<Occurrence | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [newMessage, setNewMessage] = useState('');

  const [activeTab, setActiveTab] = useState<'detalhes' | 'chat' | 'historico'>('detalhes');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<'operacao' | 'finalizadas' | 'canhotos'>('operacao');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [chatPhoto, setChatPhoto] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const alertCtxRef = useRef<any>(null);
  const chatCtxRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  const fetchOccurrences = async () => {
    const { data } = await supabase
      .from('occurrences')
      .select('*')
      .order('data_abertura', { ascending: false });

    if (data) {
      setOccurrences(data);
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
      .eq('sender_type', 'motorista');

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
      .eq('sender_type', 'motorista')
      .eq('is_read', false);

    setUnreadCounts(prev => ({ ...prev, [occurrenceId]: 0 }));
  };

  const playAlertSound = () => {
    try {
      if (!alertCtxRef.current) alertCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = alertCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (e) { console.error(e); }
  };

  const playChatSound = () => {
    try {
      if (!chatCtxRef.current) chatCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = chatCtxRef.current;
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
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchOccurrences();

    const subscription = supabase.channel('monitor_channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'occurrences' }, () => {
        playAlertSound();
        fetchOccurrences();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'occurrences' }, () => {
        fetchOccurrences();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'occurrence_messages' }, payload => {
        const msg = payload.new as Message;
        if (msg.sender_type === 'motorista') {
          if (activeOccurrence && activeOccurrence.id === msg.occurrence_id && activeTab === 'chat') {
            setChatMessages(prev => [...prev, msg]);
            markChatAsRead(msg.occurrence_id);
            playChatSound();
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          } else if (activeOccurrence && activeOccurrence.id === msg.occurrence_id) {
            setChatMessages(prev => [...prev, msg]);
            setUnreadCounts(prev => ({ ...prev, [msg.occurrence_id]: (prev[msg.occurrence_id] || 0) + 1 }));
            playChatSound();
          } else {
            setUnreadCounts(prev => ({ ...prev, [msg.occurrence_id]: (prev[msg.occurrence_id] || 0) + 1 }));
            playChatSound();
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [activeOccurrence, activeTab]);

  const loadOccurrenceDetails = async (occ: Occurrence) => {
    setActiveOccurrence(occ);
    setActiveTab('chat');

    const resChat = await supabase.from('occurrence_messages').select('*').eq('occurrence_id', occ.id).order('created_at', { ascending: true });
    setChatMessages(resChat.data || []);

    const resHist = await supabase.from('occurrence_history').select('*').eq('occurrence_id', occ.id).order('created_at', { ascending: false });
    setHistoryItems(resHist.data || []);
  };

  const handleTabSwitch = (tab: 'detalhes' | 'chat' | 'historico') => {
    setActiveTab(tab);
    if (tab === 'chat' && activeOccurrence) {
      markChatAsRead(activeOccurrence.id);
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
    if (!activeOccurrence || isUploading) return;
    if (!newMessage.trim() && !chatPhoto) return;

    setIsUploading(true);
    let attachmentUrl = null;

    try {
      if (chatPhoto) {
        attachmentUrl = await uploadFile(chatPhoto);
      }

      await supabase.from('occurrence_messages').insert([{
        occurrence_id: activeOccurrence.id,
        sender_type: 'monitor',
        sender_name: 'Central Operacional', // Or actual monitor name
        message: newMessage,
        attachment_url: attachmentUrl,
        is_read: false
      }]);

      setNewMessage('');
      setChatPhoto(null);
      const { data } = await supabase.from('occurrence_messages').select('*').eq('occurrence_id', activeOccurrence.id).order('created_at', { ascending: true });
      setChatMessages(data || []);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      alert("Erro ao enviar imagem: " + err.message);
    }

    setIsUploading(false);
  };

  const updateStatus = async (status: string, actionName: string) => {
    if (!activeOccurrence) return;
    await supabase.from('occurrences').update({ status, responsavel_atual: 'Monitor' }).eq('id', activeOccurrence.id);
    await supabase.from('occurrence_history').insert([{
      occurrence_id: activeOccurrence.id,
      acao: actionName,
      status_anterior: activeOccurrence.status,
      status_novo: status,
      responsavel: 'Central Operacional'
    }]);

    if (['Resolvida', 'Entrega Parcial', 'Retorno ao CD', 'Cancelada', 'Canhoto retido', 'Reentregar Amanhã'].includes(status)) {
      setActiveOccurrence(null);
      fetchOccurrences();
      return;
    }

    const { data } = await supabase.from('occurrences').select('*').eq('id', activeOccurrence.id).single();
    if (data) setActiveOccurrence(data);
    fetchOccurrences();

    const resHist = await supabase.from('occurrence_history').select('*').eq('occurrence_id', activeOccurrence.id).order('created_at', { ascending: false });
    setHistoryItems(resHist.data || []);
  };

  const getMinutesPassed = (dateString: string) => {
    const diff = new Date().getTime() - new Date(dateString).getTime();
    return Math.floor(diff / 60000);
  };

  const getDaysPassed = (dateString: string) => {
    const diff = new Date().getTime() - new Date(dateString).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderKanbanColumn = (title: string, statuses: string[]) => {
    const filteredBySearch = occurrences.filter(occ => {
      const q = searchQuery.toLowerCase();
      return (
        occ.placa.toLowerCase().includes(q) ||
        occ.manifesto.toLowerCase().includes(q) ||
        (occ.nf && occ.nf.toLowerCase().includes(q)) ||
        occ.cliente.toLowerCase().includes(q)
      );
    });
    const columnOccurrences = filteredBySearch.filter(o => statuses.includes(o.status));

    return (
      <div style={{ flex: '1', minWidth: '320px', maxWidth: '380px', display: 'flex', flexDirection: 'column' }}>
        <div className="mb-3 d-flex justify-content-between align-items-center bg-white p-3 rounded" style={{ boxShadow: 'var(--shadow-sm)', borderTop: `4px solid var(--color-primary)` }}>
          <h4 style={{ fontSize: '1rem', margin: 0, fontWeight: 600, color: 'var(--color-primary-dark)' }}>{title}</h4>
          <span className="badge badge-primary" style={{ fontSize: '0.875rem' }}>{columnOccurrences.length}</span>
        </div>

        <div className="d-flex flex-column" style={{ gap: '1rem', overflowY: 'auto', height: 'calc(100vh - 160px)', paddingRight: '0.5rem' }}>
          {columnOccurrences.map(occ => {
            const minutes = getMinutesPassed(occ.data_abertura);
            const unread = unreadCounts[occ.id] || 0;
            let slaColor = 'var(--color-success)';
            let isSlaStopped = ['Resolvida', 'Cancelada', 'Retorno ao CD', 'Entrega Parcial', 'Canhoto retido', 'Reentregar Amanhã'].includes(occ.status);

            if (!isSlaStopped) {
              if (minutes >= 60) slaColor = 'rgba(231, 76, 60, 0.12)'; 
              else if (minutes >= 30) slaColor = 'rgba(243, 156, 18, 0.12)';
              else slaColor = 'rgba(39, 174, 96, 0.08)';
            } else {
              slaColor = 'white';
            }

            return (
              <div key={occ.id} className="card p-3 card-hover border-0" style={{ cursor: 'pointer', position: 'relative', borderLeft: unread > 0 ? '4px solid var(--color-primary)' : '4px solid transparent', backgroundColor: unread > 0 ? 'var(--color-info-bg)' : slaColor }} onClick={() => loadOccurrenceDetails(occ)}>
                {occ.status === 'Nova' && <div className="animate-pulse" style={{ position: 'absolute', top: 12, right: 12, width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--color-danger)' }}></div>}

                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', backgroundColor: (unread > 0 || !isSlaStopped) ? 'rgba(255,255,255,0.7)' : 'var(--color-bg-main)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                    {occ.placa}
                  </div>
                  {!isSlaStopped && (
                    <div className="d-flex align-items-center" style={{ gap: '0.25rem', color: minutes >= 60 ? 'var(--color-danger)' : minutes >= 30 ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 700, fontSize: '0.875rem' }}>
                      <Clock size={14} /> {minutes}m
                    </div>
                  )}
                </div>

                <h5 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem 0', color: 'var(--color-primary-dark)' }}>{occ.tipo_ocorrencia}</h5>
                <div className="text-secondary text-sm mb-3">
                  <span className="d-block text-truncate"><strong className="text-dark">Motorista:</strong> {occ.motorista}</span>
                  <span className="d-block text-truncate"><strong className="text-dark">Cliente:</strong> {occ.cliente}</span>
                  <span className="d-block text-truncate"><strong className="text-dark">Destino:</strong> {occ.endereco}, {occ.cidade}</span>
                </div>

                <div className="d-flex justify-content-between align-items-center pt-3 mt-3" style={{ borderTop: '1px dashed var(--color-border)' }}>
                  <div className="text-muted text-xs">{formatTime(occ.data_abertura)} - {new Date(occ.data_abertura).toLocaleDateString()}</div>
                  <div className="d-flex" style={{ gap: '0.5rem' }}>
                    {unread > 0 && <div className="badge badge-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: '24px', height: '24px', padding: 0 }}>{unread}</div>}
                    <div className="badge" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}><MessageCircle size={14} /></div>
                    <div className="text-primary text-sm font-weight-bold d-flex align-items-center">Abrir <ChevronRight size={14} /></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: 'var(--color-bg-main)', minHeight: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <header style={{ backgroundColor: 'var(--color-primary-dark)', color: 'white', padding: '1rem 1.5rem', boxShadow: 'var(--shadow-md)', zIndex: 10 }}>
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center" style={{ gap: '0.75rem' }}>
            <button className="border-0 p-0 mr-2" style={{ color: 'white', boxShadow: 'none', cursor: 'pointer', background: 'transparent', backgroundColor: 'transparent', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitAppearance: 'none', appearance: 'none' }} onClick={() => setIsSidebarOpen(true)}>
              <Menu size={28} />
            </button>
            <div>
              <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>CTOE | Central de Tratativas</h1>
              <div className="text-xs" style={{ color: 'var(--color-primary-pale)' }}>Monitoramento</div>
            </div>
          </div>
          <div className="d-flex align-items-center" style={{ gap: '1.5rem' }}>
            <div className="form-control d-flex align-items-center bg-white border-0 position-relative" style={{ width: '350px', padding: '0', borderRadius: 'var(--radius-full)' }}>
              <Search size={18} className="text-muted position-absolute" style={{ left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Buscar placa, manifesto ou NF..."
                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.875rem', padding: '0.5rem 1rem 0.5rem 2.5rem', borderRadius: 'inherit' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyItems: 'center', fontWeight: 'bold', border: '2px solid var(--color-primary-pale)' }}>
              <span style={{ margin: 'auto' }}>CO</span>
            </div>
          </div>
        </div>
      </header>

      {/* Retractable Sidebar Overlay */}
      {isSidebarOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }} onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Retractable Sidebar Menu */}
      <div style={{ position: 'fixed', top: 0, left: isSidebarOpen ? 0 : '-300px', width: '280px', height: '100%', backgroundColor: 'white', zIndex: 50, transition: 'left 0.3s ease', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
        <div className="p-4 border-bottom d-flex justify-content-between align-items-center bg-light">
          <h4 className="m-0 font-weight-bold" style={{ color: 'var(--color-primary-dark)', fontSize: '1.1rem' }}>Menu Principal</h4>
          <button className="btn p-1 bg-transparent border-0 text-secondary" onClick={() => setIsSidebarOpen(false)}><X size={24} /></button>
        </div>
        <div className="d-flex flex-column pt-2">
          <button className={`btn w-100 text-left px-4 py-4 border-0 rounded-0 d-flex align-items-center ${viewMode === 'operacao' ? 'bg-light text-primary font-weight-bold' : 'text-secondary bg-white'}`} style={{ gap: '0.75rem', borderRight: viewMode === 'operacao' ? '4px solid var(--color-primary)' : '4px solid transparent' }} onClick={() => { setViewMode('operacao'); setIsSidebarOpen(false); }}>
            <Kanban size={20} /> Painel Operacional
          </button>
          <button className={`btn w-100 text-left px-4 py-4 border-0 rounded-0 d-flex align-items-center ${viewMode === 'finalizadas' ? 'bg-light text-primary font-weight-bold' : 'text-secondary bg-white'}`} style={{ gap: '0.75rem', borderRight: viewMode === 'finalizadas' ? '4px solid var(--color-primary)' : '4px solid transparent' }} onClick={() => { setViewMode('finalizadas'); setIsSidebarOpen(false); }}>
            <Archive size={20} /> Histórico Finalizadas
          </button>
          <button className={`btn w-100 text-left px-4 py-4 border-0 rounded-0 d-flex align-items-center ${viewMode === 'canhotos' ? 'bg-light text-primary font-weight-bold' : 'text-secondary bg-white'}`} style={{ gap: '0.75rem', borderRight: viewMode === 'canhotos' ? '4px solid var(--color-primary)' : '4px solid transparent' }} onClick={() => { setViewMode('canhotos'); setIsSidebarOpen(false); }}>
            <FileText size={20} /> Canhotos Retidos
          </button>
        </div>
      </div>

      <div className="d-flex flex-grow-1" style={{ overflow: 'hidden' }}>
        <div className="p-4 flex-grow-1" style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', alignItems: 'flex-start', backgroundColor: 'var(--color-bg-main)' }}>
          {viewMode === 'operacao' ? (
            <>
              {renderKanbanColumn('Novas', ['Nova'])}
              {renderKanbanColumn('Tratativa Operacional', ['Em Tratativa'])}
              {renderKanbanColumn('Aguardando Retorno', ['Aguardando Cliente', 'Aguardando CS', 'Aguardando Motorista', 'Aguardando Armazém', 'Pendência Documental'])}
              {renderKanbanColumn('Escaladas', ['Escalada'])}
            </>
          ) : viewMode === 'finalizadas' ? (
            <>
              {renderKanbanColumn('Entregas Realizadas', ['Resolvida', 'Entrega Parcial'])}
              {renderKanbanColumn('Devoluções e Cancelamentos', ['Cancelada', 'Retorno ao CD'])}
              {renderKanbanColumn('Reentregas Agendadas', ['Reentregar Amanhã'])}
            </>
          ) : (
            <>
              <div style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
                <div className="mb-3 d-flex justify-content-between align-items-center bg-white p-3 rounded" style={{ boxShadow: 'var(--shadow-sm)', borderTop: `4px solid var(--color-primary)` }}>
                  <h4 style={{ fontSize: '1rem', margin: 0, fontWeight: 600, color: 'var(--color-primary-dark)' }}>Controle de Canhotos Retidos</h4>
                  <span className="badge badge-primary">{occurrences.filter(o => o.status === 'Canhoto retido').length}</span>
                </div>
                <div className="d-flex flex-wrap" style={{ gap: '1rem' }}>
                  {occurrences.filter(o => o.status === 'Canhoto retido').map(occ => (
                    <div key={occ.id} className="card p-3 bg-white border-0" style={{ minWidth: '300px', cursor: 'pointer' }} onClick={() => loadOccurrenceDetails(occ)}>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="badge badge-info">{occ.placa}</span>
                        <span className="text-danger font-weight-bold">{getDaysPassed(occ.data_abertura)} dias retido</span>
                      </div>
                      <div className="font-weight-bold">{occ.cliente}</div>
                      <div className="text-sm text-secondary">NF: {occ.nf}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {activeOccurrence && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10, 45, 74, 0.5)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
          <div className="animate-slide-up" style={{ width: '1000px', maxWidth: '90%', backgroundColor: 'var(--color-bg-main)', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-float)' }}>

            <div className="d-flex justify-content-between align-items-center p-4 border-bottom bg-white">
              <div>
                <h2 style={{ color: 'var(--color-primary-dark)', margin: '0 0 0.25rem 0' }}>Tratativa: {activeOccurrence.tipo_ocorrencia}</h2>
                <div className="text-secondary d-flex align-items-center" style={{ gap: '1rem' }}>
                  <span>Placa: <strong className="text-dark">{activeOccurrence.placa}</strong></span>
                  <span>Manifesto: <strong className="text-dark">{activeOccurrence.manifesto}</strong></span>
                  <span className={`badge ${activeOccurrence.status === 'Nova' ? 'badge-danger' : 'badge-primary'}`}>{activeOccurrence.status}</span>
                </div>
              </div>
              <button className="btn btn-outline p-2" onClick={() => setActiveOccurrence(null)}><X size={24} /></button>
            </div>

            <div className="d-flex flex-grow-1" style={{ overflow: 'hidden' }}>
              <div style={{ flex: 1, borderRight: '1px solid var(--color-border)', overflowY: 'auto', padding: '1.5rem', backgroundColor: 'white' }}>
                <div className="card bg-light p-3 mb-4 border-0">
                  <h5 className="text-secondary mb-3 text-sm text-uppercase">Detalhes da Ocorrência</h5>
                  <div className="mb-2"><strong className="text-dark">Motorista:</strong> {activeOccurrence.motorista}</div>
                  <div className="mb-2"><strong className="text-dark">NF(s):</strong> {activeOccurrence.nf || 'Manifesto Geral'}</div>
                  <div className="mb-2"><strong className="text-dark">Cliente:</strong> {activeOccurrence.cliente}</div>
                  <div className="mb-2"><strong className="text-dark">Destino:</strong> {activeOccurrence.endereco}, {activeOccurrence.cidade}</div>

                  {activeOccurrence.latitude && activeOccurrence.longitude && (
                    <div className="mb-3 d-flex align-items-center gap-2">
                      <MapPin size={16} className="text-danger" />
                      <a href={`https://www.google.com/maps/search/?api=1&query=${activeOccurrence.latitude},${activeOccurrence.longitude}`} target="_blank" rel="noreferrer" className="text-primary font-weight-bold" style={{ textDecoration: 'none' }}>
                        Ver Localização no Mapa
                      </a>
                    </div>
                  )}

                  <div className="mt-3"><strong className="text-dark">Relato Operacional:</strong></div>
                  <div className="p-3 bg-white border rounded text-sm mt-1 mb-3">{activeOccurrence.descricao}</div>

                  {activeOccurrence.attachment_urls && activeOccurrence.attachment_urls.length > 0 && (
                    <div>
                      <strong className="text-dark d-block mb-2">Fotos / Anexos:</strong>
                      <div className="d-flex gap-2 flex-wrap">
                        {activeOccurrence.attachment_urls.map((url, i) => (
                          <img key={i} src={url} alt="Anexo" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--color-border)', cursor: 'pointer' }} onClick={() => setFullScreenImage(url)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <h5 className="text-secondary mb-3 text-sm text-uppercase text-center">Ações Operacionais</h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '2rem' }}>
                  {activeOccurrence.status === 'Nova' && (
                    <button className="btn btn-primary" onClick={() => updateStatus('Em Tratativa', 'Assumiu Ocorrência')} style={{ gridColumn: 'span 2', padding: '0.8rem' }}>
                      <CheckCircle size={18} /> Assumir Tratativa
                    </button>
                  )}
                  <button className="btn btn-outline justify-content-center" onClick={() => updateStatus('Aguardando CS', 'Encaminhado CS')}><RefreshCw size={16} /> Aguardando CS</button>
                  <button className="btn btn-outline justify-content-center" onClick={() => updateStatus('Aguardando Armazém', 'Encaminhado Armazém')}><RefreshCw size={16} /> Aguardando Armazém</button>
                  <button className="btn btn-outline justify-content-center" onClick={() => updateStatus('Pendência Documental', 'Registro Documental')}><FileText size={16} /> Pendência Documental</button>
                  <button className="btn btn-outline justify-content-center text-danger border-danger" onClick={() => updateStatus('Escalada', 'Escalonamento Crítico')}><AlertTriangle size={16} /> Escalonar (Gestão)</button>
                </div>

                <h5 className="text-secondary mt-4 mb-3 text-sm text-uppercase text-center">Finalizações de Ocorrência</h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button className="btn btn-success justify-content-center" onClick={() => updateStatus('Entrega Parcial', 'Finalizado - Parcial')}><CheckCircle size={16} /> Entrega Parcial</button>
                  <button className="btn btn-success justify-content-center" onClick={() => updateStatus('Resolvida', 'Finalizado com Sucesso')}><CheckCircle size={16} /> Entrega Realizada</button>
                  <button className="btn btn-warning justify-content-center" onClick={() => updateStatus('Canhoto retido', 'Canhoto Retido')}><FileText size={16} /> Canhoto retido</button>
                  <button className="btn btn-info justify-content-center" onClick={() => updateStatus('Reentregar Amanhã', 'Reentrega Agendada')}><RefreshCw size={16} /> Reentregar Amanhã</button>
                  <button className="btn btn-danger justify-content-center" onClick={() => updateStatus('Retorno ao CD', 'Finalizado - Retorno')}><CornerUpRight size={16} /> Retorno ao CD</button>
                  <button className="btn btn-danger justify-content-center" onClick={() => updateStatus('Cancelada', 'Cancelamento')}><XCircle size={16} /> Cancelar Ocorrência</button>
                </div>
              </div>

              <div style={{ width: '400px', display: 'flex', flexDirection: 'column', backgroundColor: '#F5F7FA' }}>
                <div className="d-flex border-bottom bg-white">
                  <button className={`btn flex-grow-1 border-0 rounded-0 position-relative ${activeTab === 'chat' ? 'border-bottom border-primary text-primary font-weight-bold' : 'text-secondary'}`} style={{ borderBottomWidth: '3px' }} onClick={() => handleTabSwitch('chat')}>
                    Chat em Tempo Real
                    {unreadCounts[activeOccurrence.id] > 0 && activeTab !== 'chat' && (
                      <span style={{ position: 'absolute', top: '0.5rem', right: '1rem', backgroundColor: 'var(--color-danger)', color: 'white', borderRadius: '10px', padding: '0.1rem 0.4rem', fontSize: '0.65rem', fontWeight: 'bold' }}>
                        {unreadCounts[activeOccurrence.id]}
                      </span>
                    )}
                  </button>
                  <button className={`btn flex-grow-1 border-0 rounded-0 ${activeTab === 'historico' ? 'border-bottom border-primary text-primary font-weight-bold' : 'text-secondary'}`} style={{ borderBottomWidth: '3px' }} onClick={() => handleTabSwitch('historico')}>
                    Auditoria
                  </button>
                </div>

                {activeTab === 'chat' && (
                  <>
                    <div className="flex-grow-1 p-3" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: '#efeae2' }}>
                      {chatMessages.length === 0 && <p className="text-center text-muted mt-4 text-sm">Nenhuma mensagem. Inicie o suporte.</p>}
                      {chatMessages.map(m => {
                        const isMonitor = m.sender_type === 'monitor';
                        return (
                          <div key={m.id} style={{ alignSelf: isMonitor ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: '0.6rem 1rem', borderRadius: isMonitor ? '1rem 1rem 0 1rem' : '1rem 1rem 1rem 0', backgroundColor: isMonitor ? '#dcf8c6' : 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                            <div className="text-xs font-weight-bold mb-1" style={{ color: isMonitor ? 'var(--color-primary-dark)' : 'var(--color-primary)' }}>{m.sender_name} {isMonitor ? '(Monitor)' : '(Motorista)'}</div>
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
                          <ImageIcon size={18} className="text-primary" />
                          <span className="text-sm font-weight-bold text-primary text-truncate" style={{ maxWidth: '200px' }}>{chatPhoto.name}</span>
                        </div>
                        <button type="button" className="btn p-1 text-danger border-0 bg-transparent" onClick={() => setChatPhoto(null)}><X size={18} /></button>
                      </div>
                    )}

                    <form onSubmit={sendMessage} className="p-2 d-flex align-items-center bg-white" style={{ gap: '0.5rem' }}>
                      <input type="file" accept="image/*" style={{ display: 'none' }} ref={chatFileInputRef} onChange={e => { if (e.target.files && e.target.files[0]) setChatPhoto(e.target.files[0]) }} />
                      <button type="button" className="btn p-2 text-secondary bg-transparent border-0" onClick={() => chatFileInputRef.current?.click()}><ImageIcon size={24} /></button>

                      <input type="text" className="form-control" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Responder motorista..." style={{ borderRadius: 'var(--radius-full)' }} />
                      <button type="submit" className="btn btn-primary rounded-circle p-0" style={{ minWidth: '44px', height: '44px' }} disabled={isUploading || (!newMessage.trim() && !chatPhoto)}>
                        <Send size={18} style={{ marginLeft: '2px' }} />
                      </button>
                    </form>
                  </>
                )}

                {activeTab === 'historico' && (
                  <div className="flex-grow-1 p-4" style={{ overflowY: 'auto', backgroundColor: 'white' }}>
                    <div style={{ borderLeft: '2px solid var(--color-border)', marginLeft: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {historyItems.map((h, i) => (
                        <div key={h.id} style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '-27px', top: '0', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: i === 0 ? 'var(--color-primary)' : 'var(--color-border)', border: '2px solid white' }}></div>
                          <div className="text-xs text-muted mb-1">{formatTime(h.created_at)} - {new Date(h.created_at).toLocaleDateString()}</div>
                          <div className="font-weight-bold text-sm" style={{ color: 'var(--color-primary-dark)' }}>{h.acao}</div>
                          <div className="text-secondary text-xs mt-1">Status: {h.status_novo}</div>
                          <div className="text-secondary text-xs">Por: {h.responsavel}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      )}

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

export default MonitorPanel;
