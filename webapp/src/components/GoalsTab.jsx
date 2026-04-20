import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Crosshair, Sparkles, X, Wallet } from 'lucide-react';

export default function GoalsTab() {
  const [goals, setGoals] = useState([]);
  const [rules, setRules] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [showTopUp, setShowTopUp] = useState(null);
  const [goalType, setGoalType] = useState('savings_goal');
  const [newGoal, setNewGoal] = useState({ name: '', icon: '🎯', target_amount: '' });
  const [newRule, setNewRule] = useState({ target_goal_id: '', percentage: '10' });
  const [topUpAmount, setTopUpAmount] = useState('');

  const fetchData = () => {
    fetch('/api/goals').then(r => r.json()).then(setGoals);
    fetch('/api/allocation_rules').then(r => r.json()).then(setRules);
    fetch('/api/recurring').then(r => r.json()).then(setRecurring);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddGoal = (e) => {
    e.preventDefault();
    fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newGoal, type: goalType, target_amount: parseFloat(newGoal.target_amount) })
    }).then(() => {
      setShowAddGoal(false);
      setNewGoal({ name: '', icon: '🎯', target_amount: '' });
      fetchData();
    });
  };

  const handleAddRule = (e) => {
    e.preventDefault();
    fetch('/api/allocation_rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_goal_id: parseInt(newRule.target_goal_id), percentage: parseFloat(newRule.percentage) })
    }).then(() => {
      setShowAddRule(false);
      setNewRule({ target_goal_id: '', percentage: '10' });
      fetchData();
    });
  };

  const handleTopUp = (goalId) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    const newSaved = (goal.amount_saved || 0) + parseFloat(topUpAmount);
    fetch(`/api/goals/${goalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_saved: newSaved })
    }).then(() => {
      setShowTopUp(null);
      setTopUpAmount('');
      fetchData();
    });
  };

  const deleteGoal = (id) => {
    if (!window.confirm('Удалить цель?')) return;
    fetch(`/api/goals/${id}`, { method: 'DELETE' }).then(fetchData);
  };
  const deleteRule = (id) => fetch(`/api/allocation_rules/${id}`, { method: 'DELETE' }).then(fetchData);

  const getGoalName = (goalId) => {
    const g = goals.find(g => g.id === goalId);
    return g ? `${g.icon || '🎯'} ${g.name}` : `Цель #${goalId}`;
  };

  const getRulePercentage = (goalId) => {
    const rule = rules.find(r => r.target_goal_id === goalId);
    return rule ? rule.percentage : 0;
  };

  // Estimate time to reach goal
  const estimateMonths = (goal) => {
    const rulePct = getRulePercentage(goal.id);
    const monthlyIncome = recurring.filter(r => r.type === 'income').reduce((a, r) => a + r.amount, 0);
    const monthlyContribution = rulePct > 0 ? (monthlyIncome * rulePct / 100) : 0;
    const remaining = goal.target_amount - (goal.amount_saved || 0);
    if (remaining <= 0) return 0;
    if (monthlyContribution <= 0) return -1; // No auto contribution
    return Math.ceil(remaining / monthlyContribution);
  };

  const wishlists = goals.filter(g => g.type === 'wishlist');
  const savings = goals.filter(g => g.type === 'savings_goal');

  const renderGoal = (g) => {
    const progress = g.target_amount > 0 ? Math.min((g.amount_saved / g.target_amount) * 100, 100) : 0;
    const rulePct = getRulePercentage(g.id);
    const months = estimateMonths(g);

    return (
      <div className="glass-card" key={g.id} style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.3rem' }}>{g.icon || '🎯'}</span>
            <strong>{g.name}</strong>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="add-btn-small" onClick={() => { setShowTopUp(g.id); setTopUpAmount(''); }} title="Пополнить">
              <Wallet size={14} />
            </button>
            <button className="delete-btn" onClick={() => deleteGoal(g.id)}><Trash2 size={14} /></button>
          </div>
        </div>

        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <span>Собрано: <strong style={{ color: '#10b981' }}>{(g.amount_saved || 0).toLocaleString()} ₽</strong></span>
          <span style={{ color: '#94a3b8' }}>Цель: {(g.target_amount || 0).toLocaleString()} ₽</span>
        </div>

        <div className="progress-bar-bg" style={{ marginTop: '8px' }}>
          <div className="progress-bar-fill" style={{ width: `${progress}%`, background: progress >= 100 ? '#10b981' : 'var(--accent)' }} />
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#64748b', marginTop: '3px' }}>{progress.toFixed(0)}%</div>

        {rulePct > 0 && (
          <div style={{ marginTop: '5px', fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Sparkles size={12} /> Авто-отчисление: {rulePct}% с дохода
          </div>
        )}

        {/* Time estimate */}
        {progress < 100 && months !== 0 && (
          <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ⏳ {months === -1 ? 'Настройте авто-отчисление для расчёта' : `≈ ${months} мес. до цели`}
          </div>
        )}

        {progress >= 100 && (
          <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#10b981', fontWeight: 600, textAlign: 'center' }}>
            🎉 Цель достигнута!
          </div>
        )}

        {/* Top up modal inline */}
        {showTopUp === g.id && (
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
            <input type="number" placeholder="Сумма ₽" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)}
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#fff', fontFamily: 'inherit' }} />
            <button className="add-btn" onClick={() => handleTopUp(g.id)} disabled={!topUpAmount}>💰</button>
            <button className="delete-btn" onClick={() => setShowTopUp(null)}><X size={14} /></button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="tab-pane">
      <h2 className="section-title">Умные цели</h2>

      {/* Savings Goals */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 className="section-title" style={{ margin: 0, color: '#f59e0b' }}>
          <Crosshair size={16} style={{ marginRight: '5px', verticalAlign: 'text-bottom' }} />Накопления
        </h3>
        <button className="add-btn-small" onClick={() => { setGoalType('savings_goal'); setNewGoal({ name: '', icon: '🎯', target_amount: '' }); setShowAddGoal(true); }}>
          <Plus size={14} />
        </button>
      </div>
      {savings.length === 0 && <p style={{ textAlign: 'center', opacity: 0.4, padding: '10px 0', fontSize: '0.9rem' }}>Нет целей накопления</p>}
      {savings.map(renderGoal)}

      {/* Wishlists */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', marginTop: '25px' }}>
        <h3 className="section-title" style={{ margin: 0, color: '#ec4899' }}>
          <Sparkles size={16} style={{ marginRight: '5px', verticalAlign: 'text-bottom' }} />Хотелки
        </h3>
        <button className="add-btn-small" onClick={() => { setGoalType('wishlist'); setNewGoal({ name: '', icon: '👕', target_amount: '' }); setShowAddGoal(true); }}>
          <Plus size={14} />
        </button>
      </div>
      {wishlists.length === 0 && <p style={{ textAlign: 'center', opacity: 0.4, padding: '10px 0', fontSize: '0.9rem' }}>Нет хотелок</p>}
      {wishlists.map(renderGoal)}

      {/* Allocation Rules */}
      <div className="glass-card" style={{ marginTop: '25px', borderColor: 'rgba(16, 185, 129, 0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 className="section-title" style={{ margin: 0, color: '#10b981' }}>Правила авто-отчислений</h3>
          <button className="add-btn-small" onClick={() => {
            if (goals.length === 0) return alert('Сначала создайте цель!');
            setNewRule({ target_goal_id: goals[0].id, percentage: '10' });
            setShowAddRule(true);
          }}><Plus size={14} /></button>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '15px' }}>
          Укажите % от каждого дохода, который автоматически пойдёт в Цель.
        </p>
        {rules.length === 0 && <p style={{ textAlign: 'center', opacity: 0.4, padding: '5px 0', fontSize: '0.85rem' }}>Нет правил</p>}
        {rules.map(r => (
          <div key={r.id} className="tx-item" style={{ marginBottom: '8px' }}>
            <span style={{ fontSize: '0.9rem' }}>{getGoalName(r.target_goal_id)}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <strong style={{ color: '#10b981' }}>{r.percentage}%</strong>
              <button className="delete-btn" onClick={() => deleteRule(r.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Goal Modal */}
      {showAddGoal && (
        <div className="modal-overlay" onClick={() => setShowAddGoal(false)}>
          <div className="glass-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{goalType === 'wishlist' ? '✨ Новая хотелка' : '🎯 Новая цель'}</h2>
              <button onClick={() => setShowAddGoal(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddGoal} className="add-form">
              <input type="text" placeholder="Название" required value={newGoal.name} onChange={e => setNewGoal({ ...newGoal, name: e.target.value })} />
              <input type="text" placeholder="Эмодзи" value={newGoal.icon} onChange={e => setNewGoal({ ...newGoal, icon: e.target.value })} />
              <input type="number" placeholder="Сумма цели (₽)" required value={newGoal.target_amount} onChange={e => setNewGoal({ ...newGoal, target_amount: e.target.value })} />
              <button type="submit" className="submit-btn">Создать</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Rule Modal */}
      {showAddRule && (
        <div className="modal-overlay" onClick={() => setShowAddRule(false)}>
          <div className="glass-card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚡ Новое правило</h2>
              <button onClick={() => setShowAddRule(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddRule} className="add-form">
              <label className="form-label">Цель</label>
              <select required value={newRule.target_goal_id} onChange={e => setNewRule({ ...newRule, target_goal_id: e.target.value })}>
                {goals.map(g => <option key={g.id} value={g.id}>{g.icon || '🎯'} {g.name}</option>)}
              </select>
              <label className="form-label">Процент от дохода</label>
              <input type="number" placeholder="%" required value={newRule.percentage} onChange={e => setNewRule({ ...newRule, percentage: e.target.value })} min="1" max="100" />
              <button type="submit" className="submit-btn">Добавить правило</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
