import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';

export default function CapitalTab() {
  const [savings, setSavings] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [debts, setDebts] = useState([]);
  const [usdRate, setUsdRate] = useState(90);

  const fetchData = () => {
    fetch('/api/savings').then(r=>r.json()).then(setSavings);
    fetch('/api/investments').then(r=>r.json()).then(setInvestments);
    fetch('/api/debts').then(r=>r.json()).then(setDebts);

    // Подтягиваем актуальный курс ЦБ РФ
    fetch('https://www.cbr-xml-daily.ru/daily_json.js')
      .then(r => r.json())
      .then(data => {
        if(data && data.Valute && data.Valute.USD) {
          setUsdRate(data.Valute.USD.Value);
        }
      })
      .catch(console.error);
  };

  useEffect(() => { fetchData(); }, []);

  const totalCapital = 
    savings.reduce((acc, s) => acc + (s.currency === 'USD' ? s.amount * usdRate : s.amount), 0) +
    investments.reduce((acc, i) => acc + i.amount, 0) -
    debts.reduce((acc, d) => acc + d.amount, 0);

  const addEntity = (endpoint, payload) => {
    fetch(`/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(fetchData);
  };

  const deleteEntity = (endpoint, id) => {
    fetch(`/api/${endpoint}/${id}`, { method: 'DELETE' }).then(fetchData);
  };

  return (
    <div className="tab-pane">
        <div className="glass-card" style={{textAlign: 'center', marginBottom: '20px'}}>
            <h2 style={{fontSize: '1rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '5px'}}>Чистый Капитал</h2>
            <div style={{fontSize: '3rem', fontWeight: 800, color: totalCapital >= 0 ? '#10b981' : '#f43f5e'}}>
                {totalCapital.toLocaleString('ru-RU', {maximumFractionDigits: 0})} ₽
            </div>
            <div style={{fontSize: '0.8rem', color: '#64748b', marginTop: '5px'}}>
                Курс ЦБ: 1$ = {usdRate.toFixed(2)} ₽
            </div>
        </div>

        {/* СБЕРЕЖЕНИЯ */}
        <div className="glass-card">
            <div style={{display:'flex', justifyContent:'space-between', marginBottom: '15px'}}>
                <h3 className="section-title" style={{margin:0}}>Сбережения (Резервы)</h3>
                <button className="add-btn-small" onClick={() => {
                    const name = prompt("Название (например, Наличные)");
                    const amount = prompt("Сумма");
                    if(name && amount) addEntity('savings', {name, currency: 'RUB', amount: parseFloat(amount)});
                }}><Plus size={14}/></button>
            </div>
            {savings.map(s => (
                <div className="tx-item" key={s.id}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem'}}>{s.name}</div>
                    <div style={{display:'flex', alignItems: 'center', gap: '10px'}}>
                        <strong className="income">{s.amount.toLocaleString()} {s.currency}</strong>
                        <button className="delete-btn" onClick={() => deleteEntity('savings', s.id)}><Trash2 size={16}/></button>
                    </div>
                </div>
            ))}
        </div>

        {/* ИНВЕСТИЦИИ */}
        <div className="glass-card">
            <div style={{display:'flex', justifyContent:'space-between', marginBottom: '15px'}}>
                <h3 className="section-title" style={{margin:0}}>Инвестиции</h3>
                <button className="add-btn-small" onClick={() => {
                    const name = prompt("Название брокера/актива");
                    const icon = prompt("Эмодзи", "📈");
                    const amount = prompt("Сумма");
                    if(name && amount) addEntity('investments', {name, icon: icon||'📈', amount: parseFloat(amount)});
                }}><Plus size={14}/></button>
            </div>
            {investments.map(i => (
                <div className="tx-item" key={i.id}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem'}}>
                        <span>{i.icon}</span> {i.name}
                    </div>
                    <div style={{display:'flex', alignItems: 'center', gap: '10px'}}>
                        <strong className="income">{i.amount.toLocaleString()} ₽</strong>
                        <button className="delete-btn" onClick={() => deleteEntity('investments', i.id)}><Trash2 size={16}/></button>
                    </div>
                </div>
            ))}
        </div>

        {/* ДОЛГИ */}
        <div className="glass-card" style={{borderColor: 'rgba(244, 63, 94, 0.2)'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom: '15px'}}>
                <h3 className="section-title" style={{margin:0, color: '#f43f5e'}}>Долги / Кредиты</h3>
                <button className="add-btn-small" style={{background: 'rgba(244, 63, 94, 0.2)', color: '#fda4af'}} onClick={() => {
                    const name = prompt("Кому должны / Название кредита");
                    const amount = prompt("Сумма");
                    if(name && amount) addEntity('debts', {name, amount: parseFloat(amount)});
                }}><Plus size={14}/></button>
            </div>
            {debts.map(d => (
                <div className="tx-item" key={d.id}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem'}}>🔴 {d.name}</div>
                    <div style={{display:'flex', alignItems: 'center', gap: '10px'}}>
                        <strong className="expense">-{d.amount.toLocaleString()} ₽</strong>
                        <button className="delete-btn" onClick={() => deleteEntity('debts', d.id)}><Trash2 size={16}/></button>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}
