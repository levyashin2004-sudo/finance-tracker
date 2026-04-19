import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

export default function ForecastTab() {
  const [recurring, setRecurring] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch('/api/recurring').then(r => r.json()).then(setRecurring);
    fetch('/api/categories').then(r => r.json()).then(setCategories);
  }, []);

  const totalExpectedIncome = recurring.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
  const totalExpectedRecurringExpense = recurring.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);
  const totalBudgets = categories.filter(c => c.type === 'expense' && c.planned_amount > 0).reduce((acc, c) => acc + c.planned_amount, 0);
  
  const totalExpectedExpenses = totalExpectedRecurringExpense + totalBudgets;
  const netForecast = totalExpectedIncome - totalExpectedExpenses;

  // Сортировка событий по календарю
  const sortedRecurring = [...recurring].sort((a,b) => a.day_of_month - b.day_of_month);

  return (
    <div className="tab-pane">
        <h2 className="section-title">План и Прогнозирование</h2>

        <div className="glass-card" style={{textAlign: 'center', marginBottom: '20px'}}>
            <div className="balance-title">Прогноз: Свободные деньги (Net)</div>
            <div style={{fontSize: '2.5rem', fontWeight: 800, color: netForecast >= 0 ? '#10b981' : '#f43f5e'}}>
                {netForecast > 0 ? '+' : ''}{netForecast.toLocaleString('ru-RU')} ₽
            </div>
            <div style={{fontSize: '0.8rem', color: '#94a3b8', marginTop: '5px'}}>В конце месяца после всех обязательств и лимитов</div>
        </div>

        <div className="glass-card">
            <h3 className="section-title" style={{margin:0, marginBottom:'15px', color:'#10b981'}}><TrendingUp size={18} style={{marginRight:'5px'}}/>Ожидаемый Доход</h3>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:'1.2rem', fontWeight:'bold', borderBottom:'1px solid rgba(255,255,255,0.05)', paddingBottom:'10px', marginBottom:'10px'}}>
                <span>Всего:</span>
                <span style={{color: '#10b981'}}>+{totalExpectedIncome.toLocaleString()} ₽</span>
            </div>
            {recurring.filter(r => r.type === 'income').map(r => (
                <div key={r.id} style={{display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:'0.9rem', color:'#cbd5e1'}}>
                    <span>{r.name} ({r.day_of_month} числа)</span>
                    <span>+{r.amount.toLocaleString()} ₽</span>
                </div>
            ))}
        </div>

        <div className="glass-card" style={{marginTop:'20px'}}>
            <h3 className="section-title" style={{margin:0, marginBottom:'15px', color:'#f43f5e'}}><TrendingDown size={18} style={{marginRight:'5px'}}/>Ожидаемые Траты</h3>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:'1.2rem', fontWeight:'bold', borderBottom:'1px solid rgba(255,255,255,0.05)', paddingBottom:'10px', marginBottom:'10px'}}>
                <span>Всего:</span>
                <span style={{color: '#f43f5e'}}>-{totalExpectedExpenses.toLocaleString()} ₽</span>
            </div>
            
            {recurring.filter(r => r.type === 'expense').length > 0 && (
                <>
                    <div style={{color:'#f59e0b', fontSize:'0.8rem', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'5px', marginTop:'15px'}}>Регулярные платежи</div>
                    {recurring.filter(r => r.type === 'expense').map(r => (
                        <div key={r.id} style={{display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:'0.9rem', color:'#cbd5e1'}}>
                            <span style={{display: 'flex', alignItems: 'center'}}><RefreshCw size={12} style={{marginRight:'5px'}}/>{r.name} ({r.day_of_month} числа)</span>
                            <span>-{r.amount.toLocaleString()} ₽</span>
                        </div>
                    ))}
                </>
            )}

            <div style={{color:'#a5b4fc', fontSize:'0.8rem', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'5px', marginTop:'15px'}}>Запланированные Лимиты (Бюджеты)</div>
            {categories.filter(c => c.type === 'expense' && c.planned_amount > 0).map(c => (
                <div key={c.id} style={{display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:'0.9rem', color:'#cbd5e1'}}>
                    <span>{c.icon} {c.name}</span>
                    <span>-{c.planned_amount.toLocaleString()} ₽</span>
                </div>
            ))}
        </div>

        <div className="glass-card" style={{marginTop:'20px'}}>
            <h3 className="section-title" style={{margin:0, marginBottom:'15px'}}><Calendar size={18} style={{marginRight:'5px', color:'#3b82f6'}}/>Календарь событий</h3>
            {sortedRecurring.length > 0 ? sortedRecurring.map(r => (
                <div key={r.id} style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                    <div style={{background:'rgba(255,255,255,0.1)', borderRadius:'50%', width:'35px', height:'35px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.85rem', fontWeight:'bold', color:'#3b82f6'}}>
                        {r.day_of_month}
                    </div>
                    <div style={{flex:1}}>
                        <div style={{fontSize:'0.9rem'}}>{r.name}</div>
                        <div style={{fontSize:'0.7rem', color:'#94a3b8'}}>{r.type === 'income' ? 'Поступление' : 'Списание'}</div>
                    </div>
                    <div className={r.type === 'income' ? 'income' : 'expense'}>
                        {r.type === 'income' ? '+' : '-'}{r.amount.toLocaleString()} ₽
                    </div>
                </div>
            )) : <div style={{textAlign: 'center', opacity: 0.5}}>Нет регулярных событий</div>}
        </div>
    </div>
  );
}
