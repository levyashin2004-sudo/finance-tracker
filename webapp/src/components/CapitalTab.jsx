import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Plus, Trash2, X } from 'lucide-react';

export default function CapitalTab() {
  const [savings, setSavings] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [debts, setDebts] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [usdRate, setUsdRate] = useState(76.05);
  const [eurRate, setEurRate] = useState(85.00);
  const [showAddSaving, setShowAddSaving] = useState(false);
  const [showAddInvest, setShowAddInvest] = useState(false);
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [newSaving, setNewSaving] = useState({ name: '', currency: 'RUB', amount: '' });
  const [newInvest, setNewInvest] = useState({ name: '', icon: '📈', amount: '' });
  const [newDebt, setNewDebt] = useState({ name: '', amount: '' });

  const fetchData = () => {
    fetch('/api/savings').then(r => r.json()).then(setSavings);
    fetch('/api/investments').then(r => r.json()).then(setInvestments);
    fetch('/api/debts').then(r => r.json()).then(setDebts);
    fetch('/api/wallets').then(r => r.json()).then(setWallets);
    fetch('/api/currency').then(r => r.json()).then(data => {
      if (data?.usdRate) setUsdRate(data.usdRate);
      if (data?.eurRate) setEurRate(data.eurRate);
    }).catch(console.error);
  };

  useEffect(() => { fetchData(); }, []);

  const toRub = (s) => {
    if (s.currency === 'USD') return s.amount * usdRate;
    if (s.currency === 'EUR') return s.amount * eurRate;
    return s.amount;
  };

  const walletsTotal = wallets.reduce((a, w) => a + (w.amount || 0), 0);
  const savingsTotal = savings.reduce((a, s) => a + toRub(s), 0);
  const investTotal = investments.reduce((a, i) => a + i.amount, 0);
  const debtsTotal = debts.reduce((a, d) => a + d.amount, 0);
  const totalCapital = walletsTotal + savingsTotal + investTotal - debtsTotal;

  // Structure chart
  const structureData = [
    { name: 'Кошельки', value: walletsTotal, fill: '#3b82f6' },
    { name: 'Сбережения', value: savingsTotal, fill: '#10b981' },
    { name: 'Инвестиции', value: investTotal, fill: '#f59e0b' },
    { name: 'Долги', value: -debtsTotal, fill: '#f43f5e' },
  ].filter(d => d.value !== 0);

  const deleteEntity = (endpoint, id) => {
    if (!window.confirm('Удалить?')) return;
    fetch(`/api/${endpoint}/${id}`, { method: 'DELETE' }).then(fetchData);
  };

  const handleAddSaving = (e) => {
    e.preventDefault();
    fetch('/api/savings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newSaving, amount: parseFloat(newSaving.amount) })
    }).then(() => { setShowAddSaving(false); setNewSaving({ name: '', currency: 'RUB', amount: '' }); fetchData(); });
  };

  const handleAddInvest = (e) => {
    e.preventDefault();
    fetch('/api/investments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newInvest, amount: parseFloat(newInvest.amount) })
    }).then(() => { setShowAddInvest(false); setNewInvest({ name: '', icon: '📈', amount: '' }); fetchData(); });
  };

  const handleAddDebt = (e) => {
    e.preventDefault();
    fetch('/api/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newDebt, amount: parseFloat(newDebt.amount) })
    }).then(() => { setShowAddDebt(false); setNewDebt({ name: '', amount: '' }); fetchData(); });
  };

  return (
    <div className="tab-pane">
      {/* Net Worth Hero */}
      <div className="glass-card" style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '1px' }}>Чистый Капитал</h2>
        <div style={{ fontSize: '3rem', fontWeight: 800, color: totalCapital >= 0 ? '#10b981' : '#f43f5e' }}>
          {totalCapital.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '5px' }}>
          Курс: 1$={usdRate.toFixed(2)} ₽ | 1€={eurRate.toFixed(2)} ₽
        </div>
      </div>

      {/* Structure Chart */}
      {structureData.length > 0 && (
        <div className="glass-card">
          <h3 className="section-title">Структура капитала</h3>
          <ResponsiveContainer width="100%" height={structureData.length * 50 + 20}>
            <BarChart data={structureData} layout="vertical" margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={90} />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(22,28,45,0.95)', border: 'none', borderRadius: '12px', color: '#fff' }}
                formatter={(val) => `${val.toLocaleString()} ₽`}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20}>
                {structureData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Wallets (auto from wallets) */}
      <div className="glass-card">
        <h3 className="section-title" style={{ margin: 0, marginBottom: '12px' }}>💳 Кошельки</h3>
        {wallets.map(w => (
          <div className="tx-item" key={w.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>{w.icon || '💳'} {w.name}</div>
            <strong className="income">{(w.amount || 0).toLocaleString()} ₽</strong>
          </div>
        ))}
        <div className="tx-item" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '8px', paddingTop: '10px' }}>
          <strong>Итого кошельки</strong>
          <strong className="income">{walletsTotal.toLocaleString()} ₽</strong>
        </div>
      </div>

      {/* Savings */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 className="section-title" style={{ margin: 0 }}>🏦 Сбережения</h3>
          <button className="add-btn-small" onClick={() => setShowAddSaving(true)}><Plus size={14} /></button>
        </div>
        {savings.length === 0 && <p style={{ textAlign: 'center', opacity: 0.4, fontSize: '0.85rem' }}>Нет сбережений</p>}
        {savings.map(s => (
          <div className="tx-item" key={s.id}>
            <div>{s.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <strong className="income">{s.amount.toLocaleString()} {s.currency}</strong>
              {s.currency !== 'RUB' && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(≈{Math.round(toRub(s)).toLocaleString()} ₽)</span>}
              <button className="delete-btn" onClick={() => deleteEntity('savings', s.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Investments */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 className="section-title" style={{ margin: 0 }}>📈 Инвестиции</h3>
          <button className="add-btn-small" onClick={() => setShowAddInvest(true)}><Plus size={14} /></button>
        </div>
        {investments.length === 0 && <p style={{ textAlign: 'center', opacity: 0.4, fontSize: '0.85rem' }}>Нет инвестиций</p>}
        {investments.map(i => (
          <div className="tx-item" key={i.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span>{i.icon}</span> {i.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <strong className="income">{i.amount.toLocaleString()} ₽</strong>
              <button className="delete-btn" onClick={() => deleteEntity('investments', i.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Debts */}
      <div className="glass-card" style={{ borderColor: 'rgba(244, 63, 94, 0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 className="section-title" style={{ margin: 0, color: '#f43f5e' }}>🔴 Долги / Кредиты</h3>
          <button className="add-btn-small" style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#fda4af' }} onClick={() => setShowAddDebt(true)}><Plus size={14} /></button>
        </div>
        {debts.length === 0 && <p style={{ textAlign: 'center', opacity: 0.4, fontSize: '0.85rem' }}>Нет долгов 🎉</p>}
        {debts.map(d => (
          <div className="tx-item" key={d.id}>
            <div>🔴 {d.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <strong className="expense">-{d.amount.toLocaleString()} ₽</strong>
              <button className="delete-btn" onClick={() => deleteEntity('debts', d.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      {showAddSaving && (
        <div className="modal-overlay" onClick={() => setShowAddSaving(false)}>
          <div className="glass-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🏦 Новое сбережение</h2>
              <button onClick={() => setShowAddSaving(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddSaving} className="add-form">
              <input type="text" placeholder="Название" required value={newSaving.name} onChange={e => setNewSaving({ ...newSaving, name: e.target.value })} />
              <select value={newSaving.currency} onChange={e => setNewSaving({ ...newSaving, currency: e.target.value })}>
                <option value="RUB">🇷🇺 RUB</option>
                <option value="USD">🇺🇸 USD</option>
                <option value="EUR">🇪🇺 EUR</option>
              </select>
              <input type="number" placeholder="Сумма" required value={newSaving.amount} onChange={e => setNewSaving({ ...newSaving, amount: e.target.value })} />
              <button type="submit" className="submit-btn">Добавить</button>
            </form>
          </div>
        </div>
      )}

      {showAddInvest && (
        <div className="modal-overlay" onClick={() => setShowAddInvest(false)}>
          <div className="glass-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📈 Новая инвестиция</h2>
              <button onClick={() => setShowAddInvest(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddInvest} className="add-form">
              <input type="text" placeholder="Название" required value={newInvest.name} onChange={e => setNewInvest({ ...newInvest, name: e.target.value })} />
              <input type="text" placeholder="Эмодзи" value={newInvest.icon} onChange={e => setNewInvest({ ...newInvest, icon: e.target.value })} />
              <input type="number" placeholder="Сумма (₽)" required value={newInvest.amount} onChange={e => setNewInvest({ ...newInvest, amount: e.target.value })} />
              <button type="submit" className="submit-btn">Добавить</button>
            </form>
          </div>
        </div>
      )}

      {showAddDebt && (
        <div className="modal-overlay" onClick={() => setShowAddDebt(false)}>
          <div className="glass-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔴 Новый долг</h2>
              <button onClick={() => setShowAddDebt(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddDebt} className="add-form">
              <input type="text" placeholder="Кому / Название" required value={newDebt.name} onChange={e => setNewDebt({ ...newDebt, name: e.target.value })} />
              <input type="number" placeholder="Сумма (₽)" required value={newDebt.amount} onChange={e => setNewDebt({ ...newDebt, amount: e.target.value })} />
              <button type="submit" className="submit-btn" style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}>Добавить долг</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
