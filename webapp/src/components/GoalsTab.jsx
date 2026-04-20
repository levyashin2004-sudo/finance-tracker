import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Crosshair, Sparkles } from 'lucide-react';

export default function GoalsTab() {
  const [goals, setGoals] = useState([]);
  const [rules, setRules] = useState([]);

  const fetchData = () => {
    fetch('/api/goals').then(r=>r.json()).then(setGoals);
    fetch('/api/allocation_rules').then(r=>r.json()).then(setRules);
  };

  useEffect(() => { fetchData(); }, []);

  const addGoal = (type) => {
    const name = prompt("Название цели");
    const icon = prompt("Эмодзи", type === 'wishlist' ? "👕" : "🎯");
    const target = prompt("Какую сумму нужно накопить?");
    if (name && target) {
      fetch('/api/goals', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name, icon, type, target_amount: parseFloat(target)})
      }).then(fetchData);
    }
  };

  const addRule = () => {
    if (goals.length === 0) return alert('Сначала создайте хотя бы одну цель!');
    const goalStr = prompt('Для какой цели? Введите номер:\\n' + goals.map((g, i) => `${i+1} — ${g.icon||'🎯'} ${g.name}`).join('\\n'));
    if (!goalStr) return;
    const goalIdx = parseInt(goalStr) - 1;
    if (goalIdx < 0 || goalIdx >= goals.length) return alert('Неверный номер');
    const percentage = prompt("Какой % от каждого дохода автоматически отчислять?", "10");
    if (percentage) {
        fetch('/api/allocation_rules', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({target_goal_id: goals[goalIdx].id, percentage: parseFloat(percentage)})
        }).then(fetchData);
    }
  };

  const deleteGoal = (id) => {
    if (!window.confirm('Удалить цель?')) return;
    fetch(`/api/goals/${id}`, {method:'DELETE'}).then(fetchData);
  };
  const deleteRule = (id) => fetch(`/api/allocation_rules/${id}`, {method:'DELETE'}).then(fetchData);

  const getGoalName = (goalId) => {
    const g = goals.find(g => g.id === goalId);
    return g ? `${g.icon||'🎯'} ${g.name}` : `Цель #${goalId}`;
  };

  const getRulePercentage = (goalId) => {
      const rule = rules.find(r => r.target_goal_id === goalId);
      return rule ? rule.percentage : 0;
  };

  const wishlists = goals.filter(g => g.type === 'wishlist');
  const savings = goals.filter(g => g.type === 'savings_goal');

  const renderGoal = (g) => {
    const progress = g.target_amount > 0 ? Math.min((g.amount_saved / g.target_amount) * 100, 100) : 0;
    const rulePct = getRulePercentage(g.id);
    return (
        <div className="glass-card" key={g.id} style={{marginBottom: '12px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                   <span style={{fontSize:'1.3rem'}}>{g.icon || '🎯'}</span>
                   <strong>{g.name}</strong>
                </div>
                <button className="delete-btn" onClick={() => deleteGoal(g.id)}><Trash2 size={14}/></button>
            </div>
            
            <div style={{marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem'}}>
                <span>Собрано: <strong style={{color: '#10b981'}}>{(g.amount_saved||0).toLocaleString()} ₽</strong></span>
                <span style={{color: '#94a3b8'}}>Цель: {(g.target_amount||0).toLocaleString()} ₽</span>
            </div>

            <div className="progress-bar-bg" style={{marginTop:'8px'}}>
                <div className="progress-bar-fill" style={{width: `${progress}%`, background: progress >= 100 ? '#10b981' : 'var(--accent)'}} />
            </div>
            <div style={{textAlign:'right', fontSize:'0.75rem', color:'#64748b', marginTop:'3px'}}>{progress.toFixed(0)}%</div>

            {rulePct > 0 && (
                <div style={{marginTop: '5px', fontSize: '0.8rem', color: '#10b981', display:'flex', alignItems:'center', gap:'5px'}}>
                    <Sparkles size={12}/> Авто-отчисление: {rulePct}% с каждого дохода
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="tab-pane">
        <h2 className="section-title">Умные цели</h2>
        
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '15px'}}>
            <h3 className="section-title" style={{margin:0, color:'#f59e0b'}}><Crosshair size={16} style={{marginRight:'5px', verticalAlign:'text-bottom'}}/>Накопления</h3>
            <button className="add-btn-small" onClick={() => addGoal('savings_goal')}><Plus size={14}/></button>
        </div>
        {savings.length === 0 && <p style={{textAlign:'center', opacity:0.4, padding:'10px 0', fontSize:'0.9rem'}}>Нет целей накопления</p>}
        {savings.map(renderGoal)}

        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '15px', marginTop:'25px'}}>
            <h3 className="section-title" style={{margin:0, color:'#ec4899'}}><Sparkles size={16} style={{marginRight:'5px', verticalAlign:'text-bottom'}}/>Хотелки</h3>
            <button className="add-btn-small" onClick={() => addGoal('wishlist')}><Plus size={14}/></button>
        </div>
        {wishlists.length === 0 && <p style={{textAlign:'center', opacity:0.4, padding:'10px 0', fontSize:'0.9rem'}}>Нет хотелок</p>}
        {wishlists.map(renderGoal)}

        {/* Allocation Rules */}
        <div className="glass-card" style={{marginTop: '25px', borderColor: 'rgba(16, 185, 129, 0.15)'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '15px'}}>
                <h3 className="section-title" style={{margin:0, color:'#10b981'}}>Правила авто-отчислений</h3>
                <button className="add-btn-small" onClick={addRule}><Plus size={14}/></button>
            </div>
            <p style={{fontSize:'0.8rem', color:'#94a3b8', marginBottom:'15px'}}>
                Укажите процент от каждого входящего дохода, который автоматически пойдёт в Цель. Остаток зачислится на Кошелёк.
            </p>
            {rules.length === 0 && <p style={{textAlign:'center', opacity:0.4, padding:'5px 0', fontSize:'0.85rem'}}>Нет правил</p>}
            {rules.map(r => (
                <div key={r.id} className="tx-item" style={{marginBottom:'8px'}}>
                    <span style={{fontSize:'0.9rem'}}>{getGoalName(r.target_goal_id)}</span>
                    <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                        <strong style={{color:'#10b981'}}>{r.percentage}%</strong>
                        <button className="delete-btn" onClick={() => deleteRule(r.id)}><Trash2 size={14}/></button>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}
