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
    const icon = prompt("Эмодзи", type === 'wishlist' ? "👕" : "📈");
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
    const goalId = prompt("Введите ID цели (отображается возле названия) для авто-отчислений:");
    const percentage = prompt("Какой процент от любого дохода отчислять автоматически? (Например: 10)");
    if(goalId && percentage) {
        fetch('/api/allocation_rules', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({target_goal_id: goalId, percentage: parseFloat(percentage)})
        }).then(fetchData);
    }
  };

  const deleteGoal = (id) => fetch(`/api/goals/${id}`, {method:'DELETE'}).then(fetchData);
  const deleteRule = (id) => fetch(`/api/allocation_rules/${id}`, {method:'DELETE'}).then(fetchData);

  const getRulePercentage = (goalId) => {
      const rule = rules.find(r => r.target_goal_id === goalId);
      return rule ? rule.percentage : 0;
  };

  const wishlists = goals.filter(g => g.type === 'wishlist');
  const savings = goals.filter(g => g.type === 'savings_goal');

  const renderGoal = (g) => {
    const progress = Math.min((g.amount_saved / g.target_amount) * 100, 100);
    const rulePct = getRulePercentage(g.id);
    return (
        <div className="glass-card" key={g.id} style={{marginBottom: '15px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                   <span style={{marginRight: '8px'}}>{g.icon}</span>
                   <strong>{g.name}</strong> <span style={{fontSize:'0.7rem', color:'#64748b'}}>ID: {g.id}</span>
                </div>
                <button className="delete-btn" onClick={() => deleteGoal(g.id)}><Trash2 size={16}/></button>
            </div>
            
            <div style={{marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem'}}>
                <span>Собрано: {g.amount_saved.toLocaleString()} ₽ <strong style={{color: '#10b981'}}>({progress.toFixed(0)}%)</strong></span>
                <span style={{color: '#94a3b8'}}>Цель: {g.target_amount.toLocaleString()} ₽</span>
            </div>

            <div style={{width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '5px', overflow:'hidden'}}>
                <div style={{width: `${progress}%`, height: '100%', background: 'var(--accent)', transition: '0.5s'}} />
            </div>

            {rulePct > 0 && (
                <div style={{marginTop: '8px', fontSize: '0.75rem', color: '#10b981', display:'flex', alignItems:'center', gap:'5px'}}>
                    <Sparkles size={12}/> Откладываем {rulePct}% с каждого дохода
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="tab-pane">
        <h2 className="section-title">Умные цели</h2>
        
        <div style={{display:'flex', justifyContent:'space-between', marginBottom: '15px'}}>
            <h3 className="section-title" style={{margin:0, color:'#f59e0b'}}><Crosshair size={18} style={{marginRight:'5px'}}/>Накопления</h3>
            <button className="add-btn-small" onClick={() => addGoal('savings_goal')}><Plus size={14}/></button>
        </div>
        {savings.map(renderGoal)}

        <div style={{display:'flex', justifyContent:'space-between', marginBottom: '15px', marginTop:'30px'}}>
            <h3 className="section-title" style={{margin:0, color:'#ec4899'}}><Sparkles size={18} style={{marginRight:'5px'}}/>Эмоциональные Хотелки</h3>
            <button className="add-btn-small" onClick={() => addGoal('wishlist')}><Plus size={14}/></button>
        </div>
        {wishlists.map(renderGoal)}

        <div className="glass-card" style={{marginTop: '30px', borderColor: 'rgba(16, 185, 129, 0.2)'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom: '15px'}}>
                <h3 className="section-title" style={{margin:0, color:'#10b981'}}>Правила отчислений</h3>
                <button className="add-btn-small" onClick={addRule}><Plus size={14}/></button>
            </div>
            <p style={{fontSize:'0.8rem', color:'#94a3b8', marginBottom:'15px'}}>
                Укажите, какой процент от любого входящего дохода автоматически переводить в указанную Цель. Остальное упадет на Карту.
            </p>
            {rules.map(r => (
                <div key={r.id} style={{display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                    <span style={{fontSize:'0.9rem'}}>Цель ID: {r.target_goal_id}</span>
                    <strong style={{color:'#10b981'}}>{r.percentage}%</strong>
                    <button className="delete-btn" onClick={() => deleteRule(r.id)}><Trash2 size={14}/></button>
                </div>
            ))}
        </div>
    </div>
  );
}
