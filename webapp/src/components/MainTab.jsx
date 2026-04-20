import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Trash2, Plus, X, ArrowRightLeft } from 'lucide-react';

const COLORS = ['#7b61ff', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'];

export default function MainTab() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  
  const myTgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || localStorage.getItem('saved_desktop_user') || '';
  
  const [formData, setFormData] = useState({ amount: '', category_id: '', user_id: myTgId, description: '', date: '', wallet_id: '' });

  const fetchData = () => {
    fetch('/api/transactions').then(res => res.json()).then(setTransactions);
    fetch('/api/categories').then(res => res.json()).then(setCategories);
    fetch('/api/wallets').then(res => res.json()).then(setWallets);
    fetch('/api/family').then(res => res.json()).then(setFamilyMembers);
  };

  useEffect(() => { fetchData(); }, []);

  const totalCards = wallets.reduce((acc, w) => acc + (w.amount || 0), 0);

  const handleDelete = (id) => {
    if (!window.confirm("Удалить операцию?")) return;
    fetch(`/api/transactions/${id}`, { method: 'DELETE' }).then(fetchData);
  };

  const handleAdd = (e) => {
    e.preventDefault();
    fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({...formData, user_id: formData.user_id || myTgId})
    }).then(() => {
      setShowModal(false);
      setFormData({ amount: '', category_id: '', user_id: myTgId, description: '', date: '', wallet_id: '' });
      fetchData();
    });
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthTx = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const expenses = currentMonthTx.filter(t => t.category_type === 'expense');
  const incomes = currentMonthTx.filter(t => t.category_type === 'income');
  const totalExpense = expenses.reduce((a, t) => a + t.amount, 0);
  const totalIncome  = incomes.reduce((a, t) => a + t.amount, 0);

  const catTotals = expenses.reduce((acc, t) => {
    const key = t.category_name || 'Без категории';
    acc[key] = (acc[key] || 0) + t.amount;
    return acc;
  }, {});
  const chartData = Object.keys(catTotals).map(key => ({ name: key, value: catTotals[key] }));

  const budgetCategories = categories.filter(c => c.planned_amount && c.planned_amount > 0);

  return (
    <div className="tab-pane">

      {/* Hero Card: Total Balance */}
      <div className="glass-card hero-card">
            <div className="hero-label">Доступно на счетах</div>
            <div className="hero-amount">
                {totalCards.toLocaleString('ru-RU', {maximumFractionDigits: 0})} ₽
            </div>
            
            <div className="hero-sub-row">
                <div className="hero-sub-item income-sub">↑ {totalIncome.toLocaleString()} ₽</div>
                <div className="hero-sub-item expense-sub">↓ {totalExpense.toLocaleString()} ₽</div>
            </div>

            <div className="wallets-row">
                {wallets.map(w => (
                    <div key={w.id} className="wallet-pill">
                        {w.icon || '💳'} {w.name}: <strong>{(w.amount||0).toLocaleString()} ₽</strong>
                    </div>
                ))}
            </div>

            <button className="transfer-btn" onClick={() => {
                if (wallets.length < 2) return alert('Нужно минимум 2 кошелька для перевода');
                const fromIdStr = prompt('Откуда списать?\\n' + wallets.map((w,i) => `${i+1} — ${w.icon||'💳'} ${w.name}`).join('\\n'));
                if (!fromIdStr) return;
                const toIdStr = prompt('Куда зачислить?\\n' + wallets.map((w,i) => `${i+1} — ${w.icon||'💳'} ${w.name}`).join('\\n'));
                if (!toIdStr) return;
                const amountStr = prompt('Сумма перевода:');
                if (!amountStr) return;
                const fromId = wallets[parseInt(fromIdStr)-1]?.id;
                const toId = wallets[parseInt(toIdStr)-1]?.id;
                const amount = parseFloat(amountStr);
                if (fromId && toId && amount && fromId !== toId) {
                    fetch('/api/transfers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount, from_wallet_id: fromId, to_wallet_id: toId })
                    }).then(fetchData);
                } else {
                    alert('Ошибка ввода данных перевода.');
                }
            }}><ArrowRightLeft size={14}/> Перевод между счетами</button>
      </div>

      {/* Pie Chart with Legend */}
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
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(22,28,45,0.95)', border:'none', borderRadius:'12px', color:'#fff' }} itemStyle={{ color: '#fff' }} formatter={(val) => `${val.toLocaleString()} ₽`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="chart-legend">
                {chartData.map((entry, index) => (
                  <div key={index} className="legend-item">
                    <span className="legend-dot" style={{background: COLORS[index % COLORS.length]}}></span>
                    <span className="legend-label">{entry.name}</span>
                    <span className="legend-value">{entry.value.toLocaleString()} ₽</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p style={{textAlign: 'center', opacity: 0.5, padding:'20px 0'}}>Нет расходов за этот месяц</p>}
        </div>
      </div>

      {/* Budgets Plan vs Fact */}
      {budgetCategories.length > 0 && (
          <div className="glass-card">
            <h2 className="section-title">Бюджеты (План / Факт)</h2>
            {budgetCategories.map(c => {
                const spent = catTotals[c.name] || 0;
                const progress = Math.min((spent / c.planned_amount) * 100, 100);
                const isOver = spent > c.planned_amount;
                return (
                    <div key={c.id} style={{marginBottom: '15px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.85rem', marginBottom:'5px'}}>
                            <span>{c.icon} {c.name}</span>
                            <span style={{color: isOver ? '#f43f5e' : '#94a3b8'}}>
                                {spent.toLocaleString()} / {c.planned_amount.toLocaleString()} ₽
                            </span>
                        </div>
                        <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{width: `${progress}%`, background: isOver ? '#f43f5e' : (progress > 85 ? '#f59e0b' : '#10b981')}} />
                        </div>
                    </div>
                );
            })}
          </div>
      )}

      {/* Transaction History */}
      <div className="glass-card">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '15px'}}>
          <h2 className="section-title" style={{margin:0}}>История операций</h2>
          <button className="add-btn" onClick={() => {
              if (wallets.length > 0) setFormData({...formData, wallet_id: wallets[0].id});
              setShowModal(true);
          }}>
            <Plus size={16} /> Добавить
          </button>
        </div>

        <div className="tx-list">
          {transactions.length === 0 && <p style={{textAlign:'center', opacity:0.4, padding:'15px 0'}}>Транзакций пока нет</p>}
          {transactions.slice(0, 50).map(t => (
            <div className="tx-item" key={t.id}>
              <div className="tx-left">
                <div className="tx-icon">{t.category_icon || '📁'}</div>
                <div className="tx-details">
                  <h4>{t.category_name} {t.is_mandatory === 1 && <span className="mandatory-badge">Обяз.</span>}</h4>
                  <div>
                    <span className="user-badge">{t.user_name || 'Семья'}</span>
                    <span> • {new Date(t.date).toLocaleDateString('ru-RU')}</span>
                    {t.wallet_name && <span style={{color:'#64748b'}}> • {t.wallet_name}</span>}
                    {t.description && <span style={{color:'#f59e0b'}}> • {t.description}</span>}
                  </div>
                </div>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                <div className={`tx-amount ${t.category_type === 'income' ? 'income' : 'expense'}`}>
                  {t.category_type === 'income' ? '+' : '-'}{t.amount.toLocaleString()} ₽
                </div>
                <button className="delete-btn" onClick={() => handleDelete(t.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="glass-card modal-content" onClick={e => e.stopPropagation()} style={{maxHeight:'90vh', overflowY:'auto'}}>
            <div className="modal-header">
              <h2>Новая операция</h2>
              <button onClick={() => setShowModal(false)} className="close-btn"><X size={20}/></button>
            </div>
            <form onSubmit={handleAdd} className="add-form">
              <input type="number" placeholder="Сумма (₽)" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              
              <label className="form-label">Кошелёк</label>
              <select required value={formData.wallet_id} onChange={e => setFormData({...formData, wallet_id: e.target.value})}>
                <option value="">Выберите кошелёк...</option>
                {wallets.map(w => <option key={w.id} value={w.id}>{w.icon||'💳'} {w.name} ({(w.amount||0).toLocaleString()}₽)</option>)}
              </select>

              <label className="form-label">Категория</label>
              <select required value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                <option value="">Выберите категорию...</option>
                <optgroup label="Расходы">
                  {categories.filter(c => c.type === 'expense').map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </optgroup>
                <optgroup label="Доходы">
                  {categories.filter(c => c.type === 'income').map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </optgroup>
              </select>

              <label className="form-label">Кто платил?</label>
              <select value={formData.user_id} onChange={e => setFormData({...formData, user_id: e.target.value})}>
                {familyMembers.length > 0 ? (
                  familyMembers.map(m => <option key={m.telegram_id} value={m.telegram_id}>{m.first_name || 'Участник'}</option>)
                ) : (
                  <option value={myTgId}>Я</option>
                )}
              </select>

              <label className="form-label">Дата (если задним числом)</label>
              <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />

              <input type="text" placeholder="Комментарий (необяз.)" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              
              <button type="submit" className="submit-btn">Сохранить</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
