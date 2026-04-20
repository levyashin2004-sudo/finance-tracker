import React, { useState, useEffect } from 'react';
import { Users, Search, Copy, LogOut, UserMinus, Plus, X, Crown, Hash } from 'lucide-react';

export default function FamilyTab() {
  const [group, setGroup] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  const myTgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || localStorage.getItem('saved_desktop_user') || '';

  const fetchGroup = () => {
    fetch('/api/group').then(r => r.json()).then(setGroup);
  };

  useEffect(() => { fetchGroup(); }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    fetch('/api/group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGroupName })
    }).then(r => r.json()).then(data => {
      if (data.success) {
        setShowCreate(false);
        setNewGroupName('');
        fetchGroup();
      }
    });
  };

  const handleJoin = (e) => {
    e.preventDefault();
    fetch('/api/group/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: joinCode })
    }).then(r => {
      if (r.ok) {
        r.json().then(data => {
          setShowJoin(false);
          setJoinCode('');
          fetchGroup();
          alert(`Вы присоединились к группе «${data.group_name}»!`);
        });
      } else {
        r.json().then(d => alert(d.error || 'Ошибка'));
      }
    });
  };

  const handleSearch = () => {
    if (searchQuery.length < 2) return;
    fetch(`/api/groups/search?q=${encodeURIComponent(searchQuery)}`).then(r => r.json()).then(setSearchResults);
  };

  const handleJoinFromSearch = (code) => {
    fetch('/api/group/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: code })
    }).then(r => {
      if (r.ok) {
        setShowSearch(false);
        setSearchQuery('');
        setSearchResults([]);
        fetchGroup();
      } else {
        r.json().then(d => alert(d.error));
      }
    });
  };

  const handleLeave = () => {
    if (!window.confirm('Покинуть группу? Вы перестанете видеть общие данные.')) return;
    fetch('/api/group/leave', { method: 'POST' }).then(() => {
      fetchGroup();
    });
  };

  const handleKick = (memberId, memberName) => {
    if (!window.confirm(`Удалить ${memberName} из группы?`)) return;
    fetch('/api/group/kick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId })
    }).then(r => {
      if (r.ok) fetchGroup();
      else r.json().then(d => alert(d.error));
    });
  };

  const copyCode = () => {
    if (group?.invite_code) {
      navigator.clipboard.writeText(group.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const AVATARS = ['#7b61ff', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#ec4899', '#8b5cf6', '#06b6d4'];
  const isCreator = group && parseInt(group.created_by) === parseInt(myTgId);
  const members = group?.members || [];

  return (
    <div className="tab-pane">
      <h2 className="section-title">Группа</h2>

      {/* Current Group Card */}
      <div className="glass-card hero-card" style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '6px' }}>👨‍👩‍👧‍👦</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{group?.name || 'Моя группа'}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
          <div className="invite-code-display">
            <Hash size={14} />
            <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '2px' }}>{group?.invite_code || '—'}</span>
          </div>
          <button className="add-btn-small" onClick={copyCode} title="Скопировать код">
            {copied ? '✅' : <Copy size={14} />}
          </button>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>
          Код приглашения — отправьте друзьям для присоединения
        </div>
      </div>

      {/* Members List */}
      <div className="glass-card">
        <h3 className="section-title" style={{ margin: 0, marginBottom: '14px' }}>
          <Users size={16} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
          Участники ({members.length})
        </h3>
        
        {members.length === 0 && (
          <p style={{ textAlign: 'center', opacity: 0.4, fontSize: '0.85rem', padding: '10px 0' }}>Загрузка...</p>
        )}

        <div className="members-grid">
          {members.map((m, idx) => {
            const isSelf = parseInt(m.telegram_id) === parseInt(myTgId);
            const isMemberCreator = parseInt(m.telegram_id) === parseInt(group?.created_by);
            return (
              <div key={m.telegram_id} className="member-card">
                <div className="member-avatar" style={{ background: AVATARS[idx % AVATARS.length] }}>
                  {m.first_name ? m.first_name[0].toUpperCase() : '?'}
                </div>
                <div className="member-info">
                  <div className="member-name">
                    {m.first_name || 'Участник'}
                    {isSelf && <span className="self-badge">Вы</span>}
                    {isMemberCreator && <Crown size={12} style={{ color: '#f59e0b', marginLeft: '4px' }} />}
                  </div>
                  <div className="member-username">
                    {m.username ? `@${m.username}` : `ID: ${m.telegram_id}`}
                  </div>
                </div>
                {isCreator && !isSelf && (
                  <button className="delete-btn" onClick={() => handleKick(m.telegram_id, m.first_name)} title="Удалить из группы">
                    <UserMinus size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="glass-card">
        <h3 className="section-title" style={{ margin: 0, marginBottom: '14px' }}>Действия</h3>
        
        <button className="family-action-btn create-btn" onClick={() => setShowCreate(true)}>
          <Plus size={18} />
          <div>
            <div className="action-title">Создать новую группу</div>
            <div className="action-desc">Станьте администратором новой группы</div>
          </div>
        </button>

        <button className="family-action-btn join-btn" onClick={() => setShowJoin(true)}>
          <Hash size={18} />
          <div>
            <div className="action-title">Ввести код приглашения</div>
            <div className="action-desc">У вас есть код? Введите его здесь</div>
          </div>
        </button>

        <button className="family-action-btn search-btn" onClick={() => setShowSearch(true)}>
          <Search size={18} />
          <div>
            <div className="action-title">Найти группу</div>
            <div className="action-desc">Поиск по названию группы</div>
          </div>
        </button>

        {members.length > 1 && (
          <button className="family-action-btn leave-btn" onClick={handleLeave}>
            <LogOut size={18} />
            <div>
              <div className="action-title">Покинуть группу</div>
              <div className="action-desc">Вы будете перемещены в личную группу</div>
            </div>
          </button>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="glass-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🆕 Новая группа</h2>
              <button onClick={() => setShowCreate(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="add-form">
              <input type="text" placeholder="Название группы (напр. Семья Ивановых)" required value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)} />
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                После создания вы получите код приглашения, который сможете отправить участникам.
              </p>
              <button type="submit" className="submit-btn">Создать группу</button>
            </form>
          </div>
        </div>
      )}

      {/* Join by Code Modal */}
      {showJoin && (
        <div className="modal-overlay" onClick={() => setShowJoin(false)}>
          <div className="glass-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔑 Код приглашения</h2>
              <button onClick={() => setShowJoin(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleJoin} className="add-form">
              <input type="text" placeholder="Введите код (напр. A1B2C3)" required value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={10}
                style={{ textAlign: 'center', fontSize: '1.3rem', letterSpacing: '3px', fontFamily: 'monospace' }} />
              <button type="submit" className="submit-btn">Присоединиться</button>
            </form>
          </div>
        </div>
      )}

      {/* Search Groups Modal */}
      {showSearch && (
        <div className="modal-overlay" onClick={() => setShowSearch(false)}>
          <div className="glass-card modal-content" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>🔍 Поиск групп</h2>
              <button onClick={() => setShowSearch(false)} className="close-btn"><X size={20} /></button>
            </div>
            <div className="search-bar" style={{ marginBottom: '12px' }}>
              <Search size={16} className="search-icon" />
              <input type="text" placeholder="Название группы..." value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="search-input" />
            </div>
            <button className="submit-btn" style={{ marginBottom: '12px' }} onClick={handleSearch}>Искать</button>

            {searchResults.length === 0 && searchQuery.length >= 2 && (
              <p style={{ textAlign: 'center', opacity: 0.5, padding: '15px 0' }}>Ничего не найдено</p>
            )}

            {searchResults.map(g => (
              <div key={g.id} className="tx-item" style={{ marginBottom: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>👥 {g.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{g.member_count} участник(ов) • #{g.invite_code}</div>
                </div>
                <button className="add-btn" onClick={() => handleJoinFromSearch(g.invite_code)}>
                  Войти
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
