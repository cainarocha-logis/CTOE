import React, { useEffect, useState } from 'react';
import { Search, Plus, Edit2, Trash2, Shield, MapPin, CheckCircle, XCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
  created_at: string;
}

interface UserUnit {
  id: string;
  user_id: string;
  unidade: string;
}

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<UserUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    perfil: 'Monitor',
    ativo: true,
    unidades: ''
  });

  const fetchUsers = async () => {
    setLoading(true);
    const { data: usersData } = await supabase.from('users').select('*').order('nome', { ascending: true });
    const { data: unitsData } = await supabase.from('user_units').select('*');
    
    if (usersData) setUsers(usersData);
    if (unitsData) setUnits(unitsData);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      const userUnits = units.filter(u => u.user_id === user.id).map(u => u.unidade).join(', ');
      setFormData({
        nome: user.nome,
        email: user.email,
        senha: '', // Don't show password
        perfil: user.perfil,
        ativo: user.ativo,
        unidades: userUnits
      });
    } else {
      setEditingUser(null);
      setFormData({
        nome: '',
        email: '',
        senha: '',
        perfil: 'Monitor',
        ativo: true,
        unidades: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let userId = editingUser?.id;

    if (editingUser) {
      // Update
      const updatePayload: any = {
        nome: formData.nome,
        email: formData.email,
        perfil: formData.perfil,
        ativo: formData.ativo
      };
      if (formData.senha) updatePayload.senha = formData.senha; // Update password only if provided

      await supabase.from('users').update(updatePayload).eq('id', editingUser.id);
    } else {
      // Insert
      const { data } = await supabase.from('users').insert([{
        nome: formData.nome,
        email: formData.email,
        senha: formData.senha, // In a real app, hash this
        perfil: formData.perfil,
        ativo: formData.ativo
      }]).select();
      
      if (data && data[0]) userId = data[0].id;
    }

    // Handle Units
    if (userId) {
      // Delete old units
      await supabase.from('user_units').delete().eq('user_id', userId);
      
      // Insert new units
      const unitArray = formData.unidades.split(',').map(u => u.trim()).filter(u => u.length > 0);
      if (unitArray.length > 0) {
        const unitInserts = unitArray.map(u => ({ user_id: userId, unidade: u }));
        await supabase.from('user_units').insert(unitInserts);
      }
    }

    setIsModalOpen(false);
    fetchUsers();
  };

  const handleToggleStatus = async (user: User) => {
    await supabase.from('users').update({ ativo: !user.ativo }).eq('id', user.id);
    fetchUsers();
  };

  const filteredUsers = users.filter(u => 
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ backgroundColor: 'var(--color-bg-main)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ backgroundColor: 'var(--color-primary-dark)', color: 'white', padding: '1rem 1.5rem', boxShadow: 'var(--shadow-md)' }}>
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center" style={{ gap: '0.75rem' }}>
            <div style={{ backgroundColor: 'var(--color-primary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
              <Shield size={24} style={{ color: 'white' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>CTOE | Painel Administrativo</h1>
              <div className="text-xs" style={{ color: 'var(--color-primary-pale)' }}>Gestão de Acessos e Permissões</div>
            </div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', border: '2px solid var(--color-primary-pale)' }}>
            AD
          </div>
        </div>
      </header>

      <div className="container mt-4 flex-grow-1">
        <div className="card p-4 border-0 mb-4" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-lg)' }}>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--color-primary-dark)' }}>Usuários do Sistema</h2>
            <button className="btn btn-primary" onClick={() => handleOpenModal()}>
              <Plus size={18} /> Novo Usuário
            </button>
          </div>

          <div className="form-control d-flex align-items-center mb-4 position-relative" style={{ padding: 0, borderRadius: 'var(--radius-md)' }}>
            <Search size={18} className="text-muted position-absolute" style={{ left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input type="text" placeholder="Pesquisar por nome ou email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', outline: 'none', width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: 'inherit', backgroundColor: 'var(--color-bg-main)' }} />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                  <th style={{ padding: '1rem 0.5rem' }}>Nome</th>
                  <th style={{ padding: '1rem 0.5rem' }}>E-mail</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Perfil</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Unidades (Filiais)</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Status</th>
                  <th style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const userUnits = units.filter(u => u.user_id === user.id).map(u => u.unidade);
                  return (
                    <tr key={user.id} style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: !user.ativo ? '#f8f9fa' : 'transparent' }}>
                      <td style={{ padding: '1rem 0.5rem', fontWeight: 500, color: 'var(--color-primary-dark)', opacity: user.ativo ? 1 : 0.5 }}>{user.nome}</td>
                      <td style={{ padding: '1rem 0.5rem', fontSize: '0.9rem', opacity: user.ativo ? 1 : 0.5 }}>{user.email}</td>
                      <td style={{ padding: '1rem 0.5rem', opacity: user.ativo ? 1 : 0.5 }}>
                        <span className={`badge ${user.perfil === 'Admin' ? 'badge-danger' : user.perfil === 'Gestor' ? 'badge-warning' : 'badge-primary'}`}>{user.perfil}</span>
                      </td>
                      <td style={{ padding: '1rem 0.5rem', fontSize: '0.85rem', opacity: user.ativo ? 1 : 0.5 }}>
                        {userUnits.length > 0 ? (
                          <div className="d-flex" style={{ gap: '0.25rem', flexWrap: 'wrap' }}>
                            {userUnits.map(un => <span key={un} className="badge" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>{un}</span>)}
                          </div>
                        ) : (
                          <span className="text-muted">Acesso Global</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        {user.ativo ? (
                          <span className="text-success d-flex align-items-center" style={{ gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600 }}><CheckCircle size={14} /> Ativo</span>
                        ) : (
                          <span className="text-danger d-flex align-items-center" style={{ gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600 }}><XCircle size={14} /> Inativo</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>
                        <div className="d-flex justify-content-end" style={{ gap: '0.5rem' }}>
                          <button className="btn btn-outline" style={{ padding: '0.4rem' }} onClick={() => handleOpenModal(user)} title="Editar Usuário"><Edit2 size={16} /></button>
                          <button className={`btn ${user.ativo ? 'btn-outline' : 'btn-success'}`} style={{ padding: '0.4rem', borderColor: user.ativo ? 'var(--color-danger)' : '', color: user.ativo ? 'var(--color-danger)' : '' }} onClick={() => handleToggleStatus(user)} title={user.ativo ? 'Desativar' : 'Reativar'}>
                            {user.ativo ? <Trash2 size={16} /> : <CheckCircle size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center p-4 text-muted">Nenhum usuário encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10, 45, 74, 0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-slide-up p-4 border-0" style={{ width: '500px', maxWidth: '90%', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-float)' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
              <button className="btn bg-transparent border-0 p-0 text-secondary" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Nome Completo</label>
                <input type="text" className="form-control" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail Corporativo</label>
                <input type="email" className="form-control" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">{editingUser ? 'Nova Senha (deixe em branco para manter)' : 'Senha de Acesso'}</label>
                <input type="password" className="form-control" value={formData.senha} onChange={e => setFormData({...formData, senha: e.target.value})} required={!editingUser} />
              </div>
              
              <div className="d-flex" style={{ gap: '1rem' }}>
                <div className="form-group flex-grow-1">
                  <label className="form-label">Perfil de Acesso</label>
                  <select className="form-control" value={formData.perfil} onChange={e => setFormData({...formData, perfil: e.target.value})}>
                    <option value="Monitor">Monitor (Operação)</option>
                    <option value="Gestor">Gestor (Visualização)</option>
                    <option value="Admin">Administrador (Total)</option>
                    <option value="CS">Customer Service</option>
                    <option value="Armazem">Armazém</option>
                  </select>
                </div>
                <div className="form-group" style={{ width: '120px' }}>
                  <label className="form-label">Status</label>
                  <select className="form-control" value={formData.ativo ? 'true' : 'false'} onChange={e => setFormData({...formData, ativo: e.target.value === 'true'})}>
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="form-group mb-4">
                <label className="form-label">
                  Unidades / Filiais Vinculadas <span className="text-muted text-xs font-weight-normal">(Separadas por vírgula)</span>
                </label>
                <div className="position-relative">
                  <MapPin size={16} className="position-absolute text-muted" style={{ left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="text" className="form-control" placeholder="Ex: BSB, GYN, SPO" value={formData.unidades} onChange={e => setFormData({...formData, unidades: e.target.value})} style={{ paddingLeft: '2.5rem' }} />
                </div>
                <div className="text-xs text-muted mt-1">Se deixar em branco, o usuário terá acesso global (todas as unidades).</div>
              </div>

              <div className="d-flex justify-content-end" style={{ gap: '0.75rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar Usuário'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;
