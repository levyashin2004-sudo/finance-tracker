import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, ArrowRightLeft, TrendingUp, TrendingDown, Calendar, X } from 'lucide-react';

const COLORS = ['#7b61ff', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'];

export default function DashboardTab() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [addType, setAddType] = useState('expense');

  const myTgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || localStorage.getItem('saved_desktop_user') || '';
  const [formData, setFormData] = useState({ amount: '', category_id: '', user_id: myTgId, description: '', date: '', wallet_id: '' });
  const [transferData, setTransferData] = useState({ amount: '', from_wallet_id: '', to_wallet_id: '' });

  const fetchData = () => {
    fetch('/api/transactions').then(r => r.json()).then(setTransactions);
    fetch('/api/categories').then(r => r.json()).then(setCategories);
    fetch('/api/wallets').then(r => r.json()).then(setWallets);
    fetch('/api/recurring').then(r => r.json()).then(setRecurring);
    fetch('/api/family').then(r => r.json()).then(setFamilyMembers);
  };

  useEffect(() => { fetchData(); }, []);

  const totalCards = wallets.reduce((a, w) => a + (w.amount || 0), 0);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysRemaining = daysInMonth - currentDay;

  const currentMonthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const expenses = currentMonthTx.filter(t => t.category_type === 'expense');
  const incomes = currentMonthTx.filter(t => t.category_type === 'income');
  const totalExpense = expenses.reduce((a, t) => a + t.amount, 0);
  const totalIncome = incomes.reduce((a, t) => a + t.amount, 0);

  const catTotals = expenses.reduce((acc, t) => {
    const key = t.category_name || 'Без категории';
    acc[key] = (acc[key] || 0) + t.amount;
    return acc;
  }, {});
  const chartData = Object.keys(catTotals).map(key => ({ name: key, value: catTotals[key] })).sort((a, b) => b.value - a.value);

  // Budget categories that are overspending or near limit
  const budgetCategories = categories.filter(c => c.planned_amount && c.planned_amount > 0)
    .map(c => {
      const spent = catTotals[c.name] || 0;
      const progress = (spent / c.planned_amount) * 100;
      return { ...c, spent, progress };
    })
    .filter(c => c.progress > 50)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3);

  // Upcoming recurring events (next 3 within rest of month)
  const upcomingEvents = [...recurring]
    .filter(r => r.day_of_month >= currentDay)
    .sort((a, b) => a.day_of_month - b.day_of_month)
    .slice(0, 3);

  const handleAdd = (e) => {
    e.preventDefault();
    fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, user_id: formData.user_id || myTgId })
    }).then(() => {
      setShowAddModal(false);
      setFormData({ amount: '', category_id: '', user_id: myTgId, description: '', date: '', wallet_id: '' });
      fetchData();
    });
  };

  const handleTransfer = (e) => {
    e.preventDefault();
    if (transferData.from_wallet_id === transferData.to_wallet_id) return;
    fetch('/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transferData)
    }).then(() => {
      setShowTransferModal(false);
      setTransferData({ amount: '', from_wallet_id: '', to_wallet_id: '' });
      fetchData();
    });
  };

  const filteredCats = categories.filter(c => c.type === addType);

  return (
    <div className="tab-pane">

      {/* Hero Card */}
      <div className="glass-card hero-card">
        <div className="hero-label">Доступно на счетах</div>
        <div className="hero-amount">{totalCards.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</div>
        <div className="hero-sub-row">
          <div className="hero-sub-item income-sub">↑ {totalIncome.toLocaleString()} ₽</div>
          <div className="hero-sub-item expense-sub">↓ {totalExpense.toLocaleString()} ₽</div>
        </div>
        <div className="wallets-row">
          {wallets.map(w => (
            <div key={w.id} className="wallet-pill">
              {w.icon || '💳'} {w.name}: <strong>{(w.amount || 0).toLocaleString()} ₽</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="quick-action-btn income-action" onClick={() => { setAddType('income'); setShowAddModal(true); if (wallets.length > 0) setFormData(f => ({ ...f, wallet_id: wallets[0].id })); }}>
          <TrendingUp size={18} /> Доход
        </button>
        <button className="quick-action-btn expense-action" onClick={() => { setAddType('expense'); setShowAddModal(true); if (wallets.length > 0) setFormData(f => ({ ...f, wallet_id: wallets[0].id })); }}>
          <TrendingDown size={18} /> Расход
        </button>
        <button className="quick-action-btn transfer-action" onClick={() => {
          if (wallets.length < 2) return alert('Нужно минимум 2 кошелька');
          setTransferData({ amount: '', from_wallet_id: wallets[0].id, to_wallet_id: wallets[1]?.id || '' });
          setShowTransferModal(true);
        }}>
          <ArrowRightLeft size={18} /> Перевод
        </button>
      </div>

      {/* Pie Chart */}
      <div className="glass-card">
        <h2 className="section-title">Расходы в этом месяце</h2>
        <div className="chart-wrapper">
          {chartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(22,28,45,0.95)', border: 'none', borderRadius: '12px', color: '#fff' }} itemStyle={{ color: '#fff' }} formatter={(val) => `${val.toLocaleString()} ₽`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="chart-legend">
                {chartData.map((entry, index) => (
                  <div key={index} className="legend-item">
                    <span className="legend-dot" style={{ background: COLORS[index % COLORS.length] }}></span>
                    <span className="legend-label">{entry.name}</span>
                    <span className="legend-value">{entry.value.toLocaleString()} ₽</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p style={{ textAlign: 'center', opacity: 0.5, padding: '20px 0' }}>Нет расходов за этот месяц</p>}
        </div>
      </div>

      {/* Budget Alerts */}
      {budgetCategories.length > 0 && (
        <div className="glass-card">
          <h2 className="section-title">⚡ Контроль бюджетов</h2>
          {budgetCategories.map(c => {
            const isOver = c.spent > c.planned_amount;
            return (
              <div key={c.id} style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '5px' }}>
                  <span>{c.icon} {c.name}</span>
                  <span style={{ color: isOver ? '#f43f5e' : c.progress > 85 ? '#f59e0b' : '#94a3b8' }}>
                    {c.spent.toLocaleString()} / {c.planned_amount.toLocaleString()} ₽
                  </span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${Math.min(c.progress, 100)}%`, background: isOver ? '#f43f5e' : (c.progress > 85 ? '#f59e0b' : '#10b981') }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="glass-card">
          <h2 className="section-title"><Calendar size={16} style={{ marginRight: '5px', verticalAlign: 'text-bottom' }} />Ближайшие события</h2>
          {upcomingEvents.map(r => (
            <div key={r.id} className="upcoming-event">
              <div className="event-day">{r.day_of_month}</div>
              <div className="event-info">
                <div className="event-name">{r.name}</div>
                <div className="event-type">{r.type === 'income' ? 'Поступление' : 'Списание'}</div>
              </div>
              <div className={r.type === 'income' ? 'income' : 'expense'} style={{ fontWeight: 700 }}>
                {r.type === 'income' ? '+' : '-'}{r.amount.toLocaleString()} ₽
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Daily Stats */}
      {totalExpense > 0 && (
        <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(123,97,255,0.05))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Средний расход в день</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '4px' }}>
                {Math.round(totalExpense / currentDay).toLocaleString()} ₽
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Осталось дней</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '4px', color: '#3b82f6' }}>{daysRemaining}</div>
            </div>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="glass-card modal-content" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>{addType === 'income' ? '💰 Новый доход' : '💳 Новый расход'}</h2>
              <button onClick={() => setShowAddModal(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd} className="add-form">
              <input type="number" placeholder="Сумма (₽)" required value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
              
              <label className="form-label">Кошелёк</label>
              <select required value={formData.wallet_id} onChange={e => setFormData({ ...formData, wallet_id: e.target.value })}>
                <option value="">Выберите кошелёк...</option>
                {wallets.map(w => <option key={w.id} value={w.id}>{w.icon || '💳'} {w.name} ({(w.amount || 0).toLocaleString()}₽)</option>)}
              </select>

              <label className="form-label">Категория</label>
              <select required value={formData.category_id} onChange={e => setFormData({ ...formData, category_id: e.target.value })}>
                <option value="">Выберите категорию...</option>
                {filteredCats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>

              <label className="form-label">Кто платил?</label>
              <select value={formData.user_id} onChange={e => setFormData({ ...formData, user_id: e.target.value })}>
                {familyMembers.length > 0 ? (
                  familyMembers.map(m => <option key={m.telegram_id} value={m.telegram_id}>{m.first_name || 'Участник'}</option>)
                ) : (
                  <option value={myTgId}>Я</option>
                )}
              </select>

              <label className="form-label">Дата</label>
              <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
              
              <input type="text" placeholder="Комментарий (необяз.)" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              
              <button type="submit" className="submit-btn">Сохранить</button>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="glass-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>↔ Перевод между счетами</h2>
              <button onClick={() => setShowTransferModal(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleTransfer} className="add-form">
              <input type="number" placeholder="Сумма (₽)" required value={transferData.amount} onChange={e => setTransferData({ ...transferData, amount: e.target.value })} />
              
              <label className="form-label">Откуда</label>
              <select required value={transferData.from_wallet_id} onChange={e => setTransferData({ ...transferData, from_wallet_id: e.target.value })}>
                <option value="">Выберите...</option>
                {wallets.map(w => <option key={w.id} value={w.id}>{w.icon || '💳'} {w.name} ({(w.amount || 0).toLocaleString()}₽)</option>)}
              </select>

              <label className="form-label">Куда</label>
              <select required value={transferData.to_wallet_id} onChange={e => setTransferData({ ...transferData, to_wallet_id: e.target.value })}>
                <option value="">Выберите...</option>
                {wallets.map(w => <option key={w.id} value={w.id}>{w.icon || '💳'} {w.name} ({(w.amount || 0).toLocaleString()}₽)</option>)}
              </select>

              <button type="submit" className="submit-btn">Перевести</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
