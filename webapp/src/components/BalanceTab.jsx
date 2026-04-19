import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

export default function BalanceTab() {
  const [transactions, setTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetch('/api/transactions')
      .then(res => res.json())
      .then(setTransactions);
  }, []);

  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  // Фильтрация по месяцу
  const filteredTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === parseInt(selectedYear);
  });

  const income = filteredTx.filter(t => t.category_type === 'income').reduce((a, b) => a + b.amount, 0);
  const expense = filteredTx.filter(t => t.category_type === 'expense').reduce((a, b) => a + b.amount, 0);
  const netIncome = income - expense;

  const chartData = [
    { name: 'Доходы', sum: income },
    { name: 'Расходы', sum: expense }
  ];

  return (
    <div className="tab-pane">
        <h2 className="section-title">Бухгалтерский баланс (P&L)</h2>
        <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
            <select className="ui-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select className="ui-select" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
            </select>
        </div>

        <div className="glass-card" style={{textAlign: 'center', marginBottom: '20px'}}>
            <div className="balance-title">Чистая прибыль (Net Income)</div>
            <div style={{fontSize: '2.5rem', fontWeight: 800, color: netIncome >= 0 ? '#10b981' : '#f43f5e'}}>
                {netIncome > 0 ? '+' : ''}{netIncome.toLocaleString('ru-RU')} ₽
            </div>
            <div style={{display: 'flex', justifyContent: 'space-around', marginTop: '15px', color: '#94a3b8'}}>
                <div>Доходы: <span style={{color: '#10b981'}}>{income.toLocaleString()} ₽</span></div>
                <div>Расходы: <span style={{color: '#f8fafc'}}>{expense.toLocaleString()} ₽</span></div>
            </div>
        </div>

        <div className="glass-card" style={{height: '300px', paddingBottom: '30px'}}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" />
                <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(22, 28, 45, 0.9)', border: 'none', borderRadius: '12px', color: '#fff' }}
                    formatter={(val) => `${val.toLocaleString()} ₽`}
                />
                <Bar dataKey="sum" radius={[0, 10, 10, 0]}>
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#f43f5e'} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
        </div>
    </div>
  );
}
