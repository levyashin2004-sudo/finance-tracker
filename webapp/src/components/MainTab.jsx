import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Trash2, Plus, X } from 'lucide-react';

const COLORS = ['#7b61ff', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#ec4899', '#8b5cf6'];

export default function MainTab() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ amount: '', category_id: '', user_id: 111111, description: '', date: '', wallet_id: '' });

  const fetchData = () => {
    fetch('/api/transactions').then(res => res.json()).then(setTransactions);
    fetch('/api/categories').then(res => res.json()).then(setCategories);
    fetch('/api/wallets').then(res => res.json()).then(setWallets);
  };

  useEffect(() => { fetchData(); }, []);

  const totalCards = wallets.reduce((acc, w) => acc + w.amount, 0);

  const handleDelete = (id) => {
    if (!window.confirm("Удалить операцию?")) return;
    fetch(`/api/transactions/${id}`, { method: 'DELETE' }).then(fetchData);
  };

  const handleAdd = (e) => {
    e.preventDefault();
    fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    }).then(() => {
      setShowModal(false);
      setFormData({ amount: '', category_id: '', user_id: 111111, description: '', date: '', wallet_id: '' });
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
  const catTotals = expenses.reduce((acc, t) => {
    acc[t.category_name] = (acc[t.category_name] || 0) + t.amount;
    return acc;
  }, {});
  const chartData = Object.keys(catTotals).map(key => ({ name: key, value: catTotals[key] }));

  const budgetCategories = categories.filter(c => c.planned_amount && c.planned_amount > 0);

  return (
    <div className="tab-pane">

      <div className="glass-card" style={{textAlign: 'center', marginBottom: '20px', background: 'linear-gradient(145deg, rgba(123, 97, 255, 0.15) 0%, rgba(22, 28, 45, 0.9) 100%)'}}>
            <h2 style={{fontSize: '0.9rem', color: '#a5b4fc', textTransform: 'uppercase', marginBottom: '5px', letterSpacing:'1px'}}>Доступно на картах</h2>
            <div style={{fontSize: '3rem', fontWeight: 800, color: '#fff'}}>
                {totalCards.toLocaleString('ru-RU')} ₽
            </div>
            
            <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '15px'}}>
                {wallets.map(w => (
                    <div key={w.id} style={{background: 'rgba(255,255,255,0.05)', padding: '5px 15px', borderRadius: '15px', fontSize: '0.9rem'}}>
                        {w.icon} {w.name}: <strong style={{color:'#10b981'}}>{w.amount.toLocaleString()} ₽</strong>
                    </div>
                ))}
            </div>

            <button className="add-btn-small" style={{marginTop: '15px', background: 'rgba(123, 97, 255, 0.3)', width: 'auto', padding: '8px 20px'}} onClick={() => {
                if (wallets.length < 2) return alert('Нужно минимум 2 кошелька для перевода');
                const fromIdStr = prompt('Откуда списать? Введите число (1-Карта, 2-Наличка и т.д.):\n' + wallets.map((w,i) => `${i+1} - ${w.name}`).join('\n'));
                if (!fromIdStr) return;
                const toIdStr = prompt('Куда зачислить? Введите число (1-Карта, 2-Наличка и т.д.):\n' + wallets.map((w,i) => `${i+1} - ${w.name}`).join('\n'));
                if (!toIdStr) return;
                const amountStr = prompt('Введите сумму перевода:');
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
            }}>⇆ Сделать перевод</button>
      </div>

      <div className="glass-card">
        <h2 className="section-title">Расходы в этом месяце</h2>
        <div className="chart-wrapper">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none">
                  {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'rgba(22,28,45,0.9)', border:'none', borderRadius:'12px', color:'#fff' }} itemStyle={{ color: '#fff' }} formatter={(val) => `${val.toLocaleString()} ₽`} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={{textAlign: 'center', opacity: 0.5}}>Нет данных</p>}
        </div>
      </div>

      {budgetCategories.length > 0 && (
          <div className="glass-card">
            <h2 className="section-title">Бюджеты (План/Факт)</h2>
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
                        <div style={{width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow:'hidden'}}>
                            <div style={{width: `${progress}%`, height: '100%', background: isOver ? '#f43f5e' : (progress > 85 ? '#f59e0b' : '#10b981'), transition: '0.5s'}} />
                        </div>
                    </div>
                );
            })}
          </div>
      )}

      <div className="glass-card">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '15px'}}>
          <h2 className="section-title" style={{margin:0}}>История операций</h2>
          <button className="add-btn" onClick={() => {
              if (wallets.length > 0) setFormData({...formData, wallet_id: wallets[0].id});
              setShowModal(true);
          }}>
            <Plus size={18} /> Операция
          </button>
        </div>

        <div className="tx-list">
          {transactions.map(t => (
            <div className="tx-item" key={t.id}>
              <div className="tx-left">
                <div className="tx-icon">{t.category_icon}</div>
                <div className="tx-details">
                  <h4>{t.category_name} {t.is_mandatory === 1 && <span className="mandatory-badge">Обязательный</span>}</h4>
                  <div>
                    <span className="user-badge">{t.user_name || 'Семья'}</span>
                    <span> • {new Date(t.date).toLocaleDateString('ru-RU')}</span>
                    {t.description && <span style={{color:'#f59e0b'}}> • {t.description}</span>}
                  </div>
                </div>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                <div className={`tx-amount ${t.category_type === 'income' ? 'income' : 'expense'}`}>
                  {t.category_type === 'income' ? '+' : '-'}{t.amount.toLocaleString()} 
                </div>
                <button className="delete-btn" onClick={() => handleDelete(t.id)}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{maxHeight:'90vh', overflowY:'auto'}}>
            <div className="modal-header">
              <h2>Новая операция</h2>
              <button onClick={() => setShowModal(false)} className="close-btn"><X size={20}/></button>
            </div>
            <form onSubmit={handleAdd} className="add-form">
              <input type="number" placeholder="Сумма (₽)" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              
              <label style={{fontSize:'0.85rem', color:'#94a3b8', marginTop:'10px', display:'block'}}>Источник (Карта/Наличка)</label>
              <select required value={formData.wallet_id} onChange={e => setFormData({...formData, wallet_id: e.target.value})}>
                <option value="">Выберите кошелек...</option>
                {wallets.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name} ({w.amount.toLocaleString()}₽)</option>)}
              </select>

              <label style={{fontSize:'0.85rem', color:'#94a3b8', marginTop:'10px', display:'block'}}>Категория</label>
              <select required value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                <option value="">Выберите категорию...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>

              <label style={{fontSize:'0.85rem', color:'#94a3b8', marginTop:'10px', display:'block'}}>Кто платил?</label>
              <select value={formData.user_id} onChange={e => setFormData({...formData, user_id: e.target.value})}>
                <option value="111111">Лев</option>
                <option value="222222">София</option>
              </select>

              <label style={{fontSize:'0.85rem', color:'#94a3b8', marginTop:'10px', display:'block'}}>Дата (если задним числом)</label>
              <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />

              <input type="text" placeholder="Комментарий" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              
              <button type="submit" className="submit-btn" style={{marginTop:'20px'}}>Сохранить и Расцепить %</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
