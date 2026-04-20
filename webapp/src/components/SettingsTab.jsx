import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X } from 'lucide-react';

export default function SettingsTab() {
  const [categories, setCategories] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [showEditWallet, setShowEditWallet] = useState(null);
  const [showEditCat, setShowEditCat] = useState(null);
  const [showEditRecurring, setShowEditRecurring] = useState(null);

  const myTgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || localStorage.getItem('saved_desktop_user') || '';

  const [newCat, setNewCat] = useState({ name: '', type: 'expense', icon: '📁', is_mandatory: false, planned_amount: 0 });
  const [newWallet, setNewWallet] = useState({ name: '', icon: '💳', amount: 0 });
  const [newRecurring, setNewRecurring] = useState({ name: '', amount: '', day_of_month: '', type: 'expense', category_id: '', wallet_id: '' });
  const [editWalletAmount, setEditWalletAmount] = useState('');
  const [editCatData, setEditCatData] = useState({ name: '', planned_amount: '' });
  const [editRecData, setEditRecData] = useState({ name: '', amount: '', day_of_month: '' });

  const fetchData = () => {
    fetch('/api/categories').then(r => r.json()).then(setCategories);
    fetch('/api/recurring').then(r => r.json()).then(setRecurring);
    fetch('/api/wallets').then(r => r.json()).then(setWallets);
  };

  useEffect(() => { fetchData(); }, []);

  // CATEGORIES
  const handleAddCat = (e) => {
    e.preventDefault();
    fetch('/api/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCat)
    }).then(() => { setShowAddCat(false); setNewCat({ name: '', type: 'expense', icon: '📁', is_mandatory: false, planned_amount: 0 }); fetchData(); });
  };
  const handleEditCat = (id) => {
    fetch(`/api/categories/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editCatData.name, planned_amount: parseFloat(editCatData.planned_amount) || 0 })
    }).then(() => { setShowEditCat(null); fetchData(); });
  };
  const deleteCat = (id) => { if (window.confirm('Удалить категорию?')) fetch(`/api/categories/${id}`, { method: 'DELETE' }).then(fetchData); };

  // WALLETS
  const handleAddWallet = (e) => {
    e.preventDefault();
    fetch('/api/wallets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newWallet, amount: parseFloat(newWallet.amount) || 0 })
    }).then(() => { setShowAddWallet(false); setNewWallet({ name: '', icon: '💳', amount: 0 }); fetchData(); });
  };
  const handleEditWallet = (id) => {
    fetch(`/api/wallets/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(editWalletAmount) || 0 })
    }).then(() => { setShowEditWallet(null); fetchData(); });
  };
  const deleteWallet = (id) => { if (window.confirm('Удалить кошелёк?')) fetch(`/api/wallets/${id}`, { method: 'DELETE' }).then(fetchData); };

  // RECURRING
  const handleAddRecurring = (e) => {
    e.preventDefault();
    fetch('/api/recurring', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newRecurring,
        amount: parseFloat(newRecurring.amount),
        day_of_month: parseInt(newRecurring.day_of_month),
        category_id: newRecurring.category_id || null,
        wallet_id: newRecurring.wallet_id || null,
        user_id: parseInt(myTgId) || null
      })
    }).then(() => { setShowAddRecurring(false); setNewRecurring({ name: '', amount: '', day_of_month: '', type: 'expense', category_id: '', wallet_id: '' }); fetchData(); });
  };
  const handleEditRecurring = (id) => {
    fetch(`/api/recurring/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editRecData.name, amount: parseFloat(editRecData.amount), day_of_month: parseInt(editRecData.day_of_month) })
    }).then(() => { setShowEditRecurring(null); fetchData(); });
  };
  const deleteRecurring = (id) => { if (window.confirm('Удалить?')) fetch(`/api/recurring/${id}`, { method: 'DELETE' }).then(fetchData); };

  const expenseCats = categories.filter(c => c.type === 'expense');
  const incomeCats = categories.filter(c => c.type === 'income');
  const filteredCatsForRecurring = categories.filter(c => c.type === newRecurring.type);

  return (
    <div className="tab-pane">
      <h2 className="section-title">Настройки</h2>

      {/* WALLETS */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 className="section-title" style={{ margin: 0, fontSize: '1rem' }}>💳 Кошельки</h3>
          <button className="add-btn-small" onClick={() => setShowAddWallet(true)}><Plus size={14} /></button>
        </div>
        {wallets.length === 0 && <p style={{ opacity: 0.4, fontSize: '0.85rem', textAlign: 'center' }}>Нет кошельков</p>}
        {wallets.map(w => (
          <div className="tx-item" key={w.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>{w.icon || '💳'}</span>
              <span style={{ fontWeight: 500 }}>{w.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ color: '#10b981' }}>{(w.amount || 0).toLocaleString()} ₽</strong>
              <button className="add-btn-small" style={{ padding: '3px 5px' }} onClick={() => { setShowEditWallet(w.id); setEditWalletAmount(w.amount); }}><Edit2 size={12} /></button>
              <button className="delete-btn" style={{ padding: '3px 5px' }} onClick={() => deleteWallet(w.id)}><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        {showEditWallet && (
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
            <input type="number" value={editWalletAmount} onChange={e => setEditWalletAmount(e.target.value)}
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', color: '#fff', fontFamily: 'inherit' }} />
            <button className="add-btn" onClick={() => handleEditWallet(showEditWallet)}>✓</button>
            <button className="delete-btn" onClick={() => setShowEditWallet(null)}><X size={14} /></button>
          </div>
        )}
      </div>

      {/* CATEGORIES */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 className="section-title" style={{ margin: 0, fontSize: '1rem' }}>📂 Категории</h3>
          <button className="add-btn-small" onClick={() => setShowAddCat(true)}><Plus size={14} /></button>
        </div>

        {expenseCats.length > 0 && (
          <>
            <div style={{ fontSize: '0.75rem', color: '#f43f5e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Расходы</div>
            {expenseCats.map(c => (
              <div className="tx-item" key={c.id} style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>{c.icon}</span>
                  <span style={{ fontWeight: 500 }}>{c.name}</span>
                  {c.is_mandatory === 1 && <span className="mandatory-badge">Обяз.</span>}
                  {c.planned_amount > 0 && <span style={{ fontSize: '0.7rem', color: '#fbbf24' }}>Лимит: {c.planned_amount.toLocaleString()}₽</span>}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="add-btn-small" style={{ padding: '3px 5px' }} onClick={() => { setShowEditCat(c.id); setEditCatData({ name: c.name, planned_amount: c.planned_amount || '' }); }}>✎</button>
                  <button className="delete-btn" style={{ padding: '3px 5px' }} onClick={() => deleteCat(c.id)}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </>
        )}

        {incomeCats.length > 0 && (
          <>
            <div style={{ fontSize: '0.75rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: '15px' }}>Доходы</div>
            {incomeCats.map(c => (
              <div className="tx-item" key={c.id} style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{c.icon}</span> <span style={{ fontWeight: 500 }}>{c.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="add-btn-small" style={{ padding: '3px 5px' }} onClick={() => { setShowEditCat(c.id); setEditCatData({ name: c.name, planned_amount: c.planned_amount || '' }); }}>✎</button>
                  <button className="delete-btn" style={{ padding: '3px 5px' }} onClick={() => deleteCat(c.id)}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </>
        )}

        {showEditCat && (
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
            <input type="text" value={editCatData.name} onChange={e => setEditCatData({ ...editCatData, name: e.target.value })} placeholder="Название"
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', color: '#fff', fontFamily: 'inherit' }} />
            <input type="number" value={editCatData.planned_amount} onChange={e => setEditCatData({ ...editCatData, planned_amount: e.target.value })} placeholder="Лимит"
              style={{ width: '80px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', color: '#fff', fontFamily: 'inherit' }} />
            <button className="add-btn" onClick={() => handleEditCat(showEditCat)}>✓</button>
            <button className="delete-btn" onClick={() => setShowEditCat(null)}><X size={14} /></button>
          </div>
        )}
      </div>

      {/* RECURRING PAYMENTS */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 className="section-title" style={{ margin: 0, fontSize: '1rem' }}>🔄 Регулярные платежи</h3>
          <button className="add-btn-small" onClick={() => setShowAddRecurring(true)}><Plus size={14} /></button>
        </div>
        {recurring.length === 0 && <p style={{ opacity: 0.4, fontSize: '0.85rem', textAlign: 'center' }}>Нет регулярных платежей</p>}
        {recurring.map(r => (
          <div className="tx-item" key={r.id} style={{ marginBottom: '8px' }}>
            <div>
              <div style={{ fontWeight: 500 }}>{r.type === 'income' ? '💰' : '💳'} {r.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Каждого {r.day_of_month}-го числа</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong className={r.type === 'income' ? 'income' : 'expense'}>{r.type === 'income' ? '+' : '-'}{(r.amount || 0).toLocaleString()} ₽</strong>
              <button className="add-btn-small" style={{ padding: '3px 5px' }} onClick={() => { setShowEditRecurring(r.id); setEditRecData({ name: r.name, amount: r.amount, day_of_month: r.day_of_month }); }}>✎</button>
              <button className="delete-btn" style={{ padding: '3px 5px' }} onClick={() => deleteRecurring(r.id)}><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        {showEditRecurring && (
          <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <input type="text" value={editRecData.name} onChange={e => setEditRecData({ ...editRecData, name: e.target.value })} placeholder="Название"
              style={{ flex: 2, minWidth: '100px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', color: '#fff', fontFamily: 'inherit' }} />
            <input type="number" value={editRecData.amount} onChange={e => setEditRecData({ ...editRecData, amount: e.target.value })} placeholder="₽"
              style={{ width: '70px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', color: '#fff', fontFamily: 'inherit' }} />
            <input type="number" value={editRecData.day_of_month} onChange={e => setEditRecData({ ...editRecData, day_of_month: e.target.value })} placeholder="День" min="1" max="31"
              style={{ width: '55px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', color: '#fff', fontFamily: 'inherit' }} />
            <button className="add-btn" onClick={() => handleEditRecurring(showEditRecurring)}>✓</button>
            <button className="delete-btn" onClick={() => setShowEditRecurring(null)}><X size={14} /></button>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showAddWallet && (
        <div className="modal-overlay" onClick={() => setShowAddWallet(false)}>
          <div className="glass-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>💳 Новый кошелёк</h2><button onClick={() => setShowAddWallet(false)} className="close-btn"><X size={20} /></button></div>
            <form onSubmit={handleAddWallet} className="add-form">
              <input type="text" placeholder="Название" required value={newWallet.name} onChange={e => setNewWallet({ ...newWallet, name: e.target.value })} />
              <input type="text" placeholder="Эмодзи" value={newWallet.icon} onChange={e => setNewWallet({ ...newWallet, icon: e.target.value })} />
              <input type="number" placeholder="Начальный баланс" value={newWallet.amount} onChange={e => setNewWallet({ ...newWallet, amount: e.target.value })} />
              <button type="submit" className="submit-btn">Добавить</button>
            </form>
          </div>
        </div>
      )}

      {showAddCat && (
        <div className="modal-overlay" onClick={() => setShowAddCat(false)}>
          <div className="glass-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>📂 Новая категория</h2><button onClick={() => setShowAddCat(false)} className="close-btn"><X size={20} /></button></div>
            <form onSubmit={handleAddCat} className="add-form">
              <input type="text" placeholder="Название" required value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} />
              <input type="text" placeholder="Эмодзи" value={newCat.icon} onChange={e => setNewCat({ ...newCat, icon: e.target.value })} />
              <select value={newCat.type} onChange={e => setNewCat({ ...newCat, type: e.target.value })}>
                <option value="expense">Расход</option>
                <option value="income">Доход</option>
              </select>
              {newCat.type === 'expense' && (
                <>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={newCat.is_mandatory} onChange={e => setNewCat({ ...newCat, is_mandatory: e.target.checked })} /> Обязательная трата
                  </label>
                  <input type="number" placeholder="Лимит в месяц (0 = без лимита)" value={newCat.planned_amount}
                    onChange={e => setNewCat({ ...newCat, planned_amount: parseFloat(e.target.value) || 0 })} />
                </>
              )}
              <button type="submit" className="submit-btn">Добавить</button>
            </form>
          </div>
        </div>
      )}

      {showAddRecurring && (
        <div className="modal-overlay" onClick={() => setShowAddRecurring(false)}>
          <div className="glass-card modal-content" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header"><h2>🔄 Новый платёж</h2><button onClick={() => setShowAddRecurring(false)} className="close-btn"><X size={20} /></button></div>
            <form onSubmit={handleAddRecurring} className="add-form">
              <input type="text" placeholder="Название (Зарплата, Аренда...)" required value={newRecurring.name} onChange={e => setNewRecurring({ ...newRecurring, name: e.target.value })} />
              <input type="number" placeholder="Сумма (₽)" required value={newRecurring.amount} onChange={e => setNewRecurring({ ...newRecurring, amount: e.target.value })} />
              <input type="number" placeholder="День месяца (1-31)" required min="1" max="31" value={newRecurring.day_of_month} onChange={e => setNewRecurring({ ...newRecurring, day_of_month: e.target.value })} />
              <select value={newRecurring.type} onChange={e => setNewRecurring({ ...newRecurring, type: e.target.value, category_id: '' })}>
                <option value="expense">Расход</option>
                <option value="income">Доход</option>
              </select>
              <label className="form-label">Категория (необяз.)</label>
              <select value={newRecurring.category_id} onChange={e => setNewRecurring({ ...newRecurring, category_id: e.target.value })}>
                <option value="">Без категории</option>
                {filteredCatsForRecurring.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <label className="form-label">Кошелёк (необяз.)</label>
              <select value={newRecurring.wallet_id} onChange={e => setNewRecurring({ ...newRecurring, wallet_id: e.target.value })}>
                <option value="">Без кошелька</option>
                {wallets.map(w => <option key={w.id} value={w.id}>{w.icon || '💳'} {w.name}</option>)}
              </select>
              <button type="submit" className="submit-btn">Добавить</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
