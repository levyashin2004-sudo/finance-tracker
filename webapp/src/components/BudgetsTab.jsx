import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

export default function BudgetsTab() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetch('/api/transactions').then(r => r.json()).then(setTransactions);
    fetch('/api/categories').then(r => r.json()).then(setCategories);
  }, []);

  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(parseInt(selectedYear), parseInt(selectedMonth) + 1, 0).getDate();
  const isCurrentMonth = parseInt(selectedMonth) === now.getMonth() && parseInt(selectedYear) === now.getFullYear();

  // Filter transactions for selected month
  const monthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === parseInt(selectedYear);
  });

  // Filter for previous month (comparison)
  const prevMonth = parseInt(selectedMonth) === 0 ? 11 : parseInt(selectedMonth) - 1;
  const prevYear = parseInt(selectedMonth) === 0 ? parseInt(selectedYear) - 1 : parseInt(selectedYear);
  const prevMonthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  });

  const expenses = monthTx.filter(t => t.category_type === 'expense');
  const incomes = monthTx.filter(t => t.category_type === 'income');
  const totalExpense = expenses.reduce((a, t) => a + t.amount, 0);
  const totalIncome = incomes.reduce((a, t) => a + t.amount, 0);
  const netIncome = totalIncome - totalExpense;

  const prevExpenses = prevMonthTx.filter(t => t.category_type === 'expense');
  const prevTotalExpense = prevExpenses.reduce((a, t) => a + t.amount, 0);

  // Category spending
  const catTotals = expenses.reduce((acc, t) => {
    acc[t.category_name] = (acc[t.category_name] || 0) + t.amount;
    return acc;
  }, {});

  const prevCatTotals = prevExpenses.reduce((acc, t) => {
    acc[t.category_name] = (acc[t.category_name] || 0) + t.amount;
    return acc;
  }, {});

  // Budget categories with plan/fact
  const budgetCategories = categories
    .filter(c => c.planned_amount && c.planned_amount > 0 && c.type === 'expense')
    .map(c => {
      const spent = catTotals[c.name] || 0;
      const progress = Math.min((spent / c.planned_amount) * 100, 100);
      const isOver = spent > c.planned_amount;
      return { ...c, spent, progress, isOver };
    });

  const totalBudget = budgetCategories.reduce((a, c) => a + c.planned_amount, 0);
  const totalBudgetSpent = budgetCategories.reduce((a, c) => a + c.spent, 0);
  const totalBudgetProgress = totalBudget > 0 ? (totalBudgetSpent / totalBudget) * 100 : 0;

  // Daily average
  const daysDone = isCurrentMonth ? currentDay : daysInMonth;
  const dailyAvg = daysDone > 0 ? Math.round(totalExpense / daysDone) : 0;

  // Mandatory vs Optional
  const mandatorySpent = expenses.filter(t => t.is_mandatory).reduce((a, t) => a + t.amount, 0);
  const optionalSpent = totalExpense - mandatorySpent;

  // Comparison bar chart
  const comparisonData = Object.keys({ ...catTotals, ...prevCatTotals })
    .filter(name => (catTotals[name] || 0) > 0 || (prevCatTotals[name] || 0) > 0)
    .map(name => ({
      name: name.length > 12 ? name.substring(0, 12) + '…' : name,
      current: catTotals[name] || 0,
      previous: prevCatTotals[name] || 0
    }))
    .sort((a, b) => b.current - a.current);

  return (
    <div className="tab-pane">
      <h2 className="section-title">Бюджеты — План vs Факт</h2>

      {/* Period */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <select className="ui-select" style={{ flex: 1 }} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
          {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select className="ui-select" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
          <option value="2026">2026</option>
          <option value="2025">2025</option>
        </select>
      </div>

      {/* P&L Hero */}
      <div className="glass-card" style={{ textAlign: 'center' }}>
        <div className="balance-title">Чистая прибыль (P&L)</div>
        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: netIncome >= 0 ? '#10b981' : '#f43f5e' }}>
          {netIncome > 0 ? '+' : ''}{netIncome.toLocaleString('ru-RU')} ₽
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '15px', color: '#94a3b8' }}>
          <div>Доходы: <span style={{ color: '#10b981' }}>{totalIncome.toLocaleString()} ₽</span></div>
          <div>Расходы: <span style={{ color: '#f8fafc' }}>{totalExpense.toLocaleString()} ₽</span></div>
        </div>
      </div>

      {/* Overall Budget Progress */}
      {totalBudget > 0 && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 className="section-title" style={{ margin: 0 }}>📊 Общий бюджет</h3>
            <span style={{ fontSize: '0.85rem', color: totalBudgetProgress > 100 ? '#f43f5e' : '#94a3b8' }}>
              {totalBudgetSpent.toLocaleString()} / {totalBudget.toLocaleString()} ₽
            </span>
          </div>
          <div className="progress-bar-bg" style={{ height: '10px' }}>
            <div className="progress-bar-fill" style={{
              width: `${Math.min(totalBudgetProgress, 100)}%`,
              height: '100%',
              background: totalBudgetProgress > 100 ? '#f43f5e' : totalBudgetProgress > 85 ? '#f59e0b' : '#10b981'
            }} />
          </div>
          {totalBudget > totalBudgetSpent && (
            <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '6px', textAlign: 'center' }}>
              Осталось {(totalBudget - totalBudgetSpent).toLocaleString()} ₽
            </div>
          )}
        </div>
      )}

      {/* Per-category budgets */}
      {budgetCategories.length > 0 && (
        <div className="glass-card">
          <h3 className="section-title" style={{ marginBottom: '14px' }}>По категориям</h3>
          {budgetCategories.map(c => (
            <div key={c.id} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '5px' }}>
                <span>{c.icon} {c.name}</span>
                <span style={{ color: c.isOver ? '#f43f5e' : c.progress > 85 ? '#f59e0b' : '#94a3b8' }}>
                  {c.spent.toLocaleString()} / {c.planned_amount.toLocaleString()} ₽
                </span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{
                  width: `${c.progress}%`,
                  background: c.isOver ? '#f43f5e' : (c.progress > 85 ? '#f59e0b' : '#10b981')
                }} />
              </div>
              {c.isOver && (
                <div style={{ fontSize: '0.75rem', color: '#f43f5e', marginTop: '3px' }}>
                  ⚠ Перерасход на {(c.spent - c.planned_amount).toLocaleString()} ₽
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Daily Rate + Mandatory/Optional split */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div className="glass-card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>В день</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px' }}>{dailyAvg.toLocaleString()} ₽</div>
        </div>
        <div className="glass-card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#f43f5e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Обязательные</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '4px' }}>{mandatorySpent.toLocaleString()} ₽</div>
        </div>
        <div className="glass-card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Свободные</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '4px' }}>{optionalSpent.toLocaleString()} ₽</div>
        </div>
      </div>

      {/* Comparison with previous month */}
      {comparisonData.length > 0 && (
        <div className="glass-card">
          <h3 className="section-title">📈 vs Прошлый месяц</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.8rem', color: '#94a3b8' }}>
            <span>Было: {prevTotalExpense.toLocaleString()} ₽</span>
            <span style={{ color: totalExpense > prevTotalExpense ? '#f43f5e' : '#10b981' }}>
              {totalExpense > prevTotalExpense ? '↑' : '↓'} {Math.abs(totalExpense - prevTotalExpense).toLocaleString()} ₽
            </span>
          </div>
          <ResponsiveContainer width="100%" height={comparisonData.length * 40 + 30}>
            <BarChart data={comparisonData} layout="vertical" margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={90} />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(22,28,45,0.95)', border: 'none', borderRadius: '12px', color: '#fff' }}
                formatter={(val) => `${val.toLocaleString()} ₽`}
              />
              <Bar dataKey="current" fill="#7b61ff" name="Текущий" radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="previous" fill="#334155" name="Прошлый" radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#94a3b8' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#7b61ff' }}></span> Текущий
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#94a3b8' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#334155' }}></span> Прошлый
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
