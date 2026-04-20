import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, RefreshCw, AlertTriangle } from 'lucide-react';

export default function ForecastTab() {
  const [recurring, setRecurring] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    fetch('/api/recurring').then(r => r.json()).then(setRecurring);
    fetch('/api/categories').then(r => r.json()).then(setCategories);
    fetch('/api/wallets').then(r => r.json()).then(setWallets);
    fetch('/api/transactions').then(r => r.json()).then(setTransactions);
  }, []);

  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const totalExpectedIncome = recurring.filter(r => r.type === 'income').reduce((a, r) => a + r.amount, 0);
  const totalExpectedRecurringExpense = recurring.filter(r => r.type === 'expense').reduce((a, r) => a + r.amount, 0);
  const totalBudgets = categories.filter(c => c.type === 'expense' && c.planned_amount > 0).reduce((a, c) => a + c.planned_amount, 0);
  const totalExpectedExpenses = totalExpectedRecurringExpense + totalBudgets;
  const netForecast = totalExpectedIncome - totalExpectedExpenses;

  // Build cash flow chart data
  const currentBalance = wallets.reduce((a, w) => a + (w.amount || 0), 0);
  
  // Actual daily spending from transactions this month
  const monthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const dailyNet = {};
  monthTx.forEach(t => {
    const day = new Date(t.date).getDate();
    if (!dailyNet[day]) dailyNet[day] = 0;
    dailyNet[day] += (t.category_type === 'income' ? t.amount : -t.amount);
  });

  // Build chart: actual up to today, forecast from today
  const chartData = [];
  let runningBalance = currentBalance;
  
  // Work backwards from current balance to get starting balance
  for (let d = currentDay; d >= 1; d--) {
    if (dailyNet[d]) runningBalance -= dailyNet[d];
  }
  let bal = runningBalance;
  
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === currentDay;
    const isFuture = d > currentDay;
    
    if (d <= currentDay && dailyNet[d]) {
      bal += dailyNet[d];
    }
    
    // Add recurring events for future days
    if (isFuture) {
      recurring.forEach(r => {
        if (r.day_of_month === d) {
          bal += (r.type === 'income' ? r.amount : -r.amount);
        }
      });
      // Spread budget expenses evenly across remaining days
      const dailyBudgetBurn = totalBudgets / daysInMonth;
      bal -= dailyBudgetBurn;
    }

    chartData.push({
      day: d,
      balance: Math.round(bal),
      actual: d <= currentDay ? Math.round(bal) : null,
      forecast: d >= currentDay ? Math.round(bal) : null,
    });
  }

  // Danger signals
  const dangerDays = [];
  recurring.filter(r => r.type === 'expense').forEach(r => {
    if (r.day_of_month > currentDay) {
      const dayData = chartData.find(d => d.day === r.day_of_month);
      if (dayData && dayData.forecast !== null && dayData.forecast < 0) {
        dangerDays.push({ day: r.day_of_month, name: r.name, amount: r.amount, projectedBalance: dayData.forecast });
      }
    }
  });

  // Sorted calendar
  const sortedRecurring = [...recurring].sort((a, b) => a.day_of_month - b.day_of_month);

  return (
    <div className="tab-pane">
      <h2 className="section-title">Прогноз и Cash Flow</h2>

      {/* Net Forecast */}
      <div className="glass-card" style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div className="balance-title">Прогноз: Свободные деньги</div>
        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: netForecast >= 0 ? '#10b981' : '#f43f5e' }}>
          {netForecast > 0 ? '+' : ''}{netForecast.toLocaleString('ru-RU')} ₽
        </div>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '5px' }}>В конце месяца после всех обязательств</div>
      </div>

      {/* Danger Signals */}
      {dangerDays.length > 0 && (
        <div className="glass-card" style={{ borderColor: 'rgba(244, 63, 94, 0.3)', background: 'rgba(244, 63, 94, 0.05)' }}>
          <h3 className="section-title" style={{ color: '#f43f5e', margin: 0, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={16} /> Внимание!
          </h3>
          {dangerDays.map((d, i) => (
            <div key={i} style={{ fontSize: '0.85rem', color: '#fda4af', padding: '5px 0' }}>
              ⚠ {d.day}-го числа баланс может уйти в <strong style={{ color: '#f43f5e' }}>{d.projectedBalance.toLocaleString()} ₽</strong> после оплаты «{d.name}»
            </div>
          ))}
        </div>
      )}

      {/* Cash Flow Chart */}
      {chartData.length > 0 && (
        <div className="glass-card">
          <h3 className="section-title">💹 Cash Flow — график баланса</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(22,28,45,0.95)', border: 'none', borderRadius: '12px', color: '#fff' }}
                formatter={(val) => val !== null ? [`${val.toLocaleString()} ₽`, ''] : [null, '']}
                labelFormatter={(l) => `${l}-е число`}
              />
              <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="5 3" strokeOpacity={0.5} />
              <ReferenceLine x={currentDay} stroke="#7b61ff" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: 'Сегодня', fill: '#a5b4fc', fontSize: 10 }} />
              <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2.5} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="forecast" stroke="#7b61ff" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#94a3b8' }}>
              <span style={{ width: '16px', height: '2px', background: '#10b981', display: 'inline-block' }}></span> Факт
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#94a3b8' }}>
              <span style={{ width: '16px', height: '2px', background: '#7b61ff', display: 'inline-block', borderBottom: '1px dashed #7b61ff' }}></span> Прогноз
            </div>
          </div>
        </div>
      )}

      {/* Income */}
      <div className="glass-card">
        <h3 className="section-title" style={{ margin: 0, marginBottom: '15px', color: '#10b981' }}>
          <TrendingUp size={18} style={{ marginRight: '5px' }} />Ожидаемый Доход
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px', marginBottom: '10px' }}>
          <span>Всего:</span>
          <span style={{ color: '#10b981' }}>+{totalExpectedIncome.toLocaleString()} ₽</span>
        </div>
        {recurring.filter(r => r.type === 'income').map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.9rem', color: '#cbd5e1' }}>
            <span>{r.name} ({r.day_of_month} числа)</span>
            <span>+{r.amount.toLocaleString()} ₽</span>
          </div>
        ))}
      </div>

      {/* Expenses */}
      <div className="glass-card">
        <h3 className="section-title" style={{ margin: 0, marginBottom: '15px', color: '#f43f5e' }}>
          <TrendingDown size={18} style={{ marginRight: '5px' }} />Ожидаемые Траты
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px', marginBottom: '10px' }}>
          <span>Всего:</span>
          <span style={{ color: '#f43f5e' }}>-{totalExpectedExpenses.toLocaleString()} ₽</span>
        </div>

        {recurring.filter(r => r.type === 'expense').length > 0 && (
          <>
            <div style={{ color: '#f59e0b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px', marginTop: '10px' }}>Регулярные платежи</div>
            {recurring.filter(r => r.type === 'expense').map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <span style={{ display: 'flex', alignItems: 'center' }}><RefreshCw size={12} style={{ marginRight: '5px' }} />{r.name} ({r.day_of_month} числа)</span>
                <span>-{r.amount.toLocaleString()} ₽</span>
              </div>
            ))}
          </>
        )}

        <div style={{ color: '#a5b4fc', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px', marginTop: '15px' }}>Бюджетные лимиты</div>
        {categories.filter(c => c.type === 'expense' && c.planned_amount > 0).map(c => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.9rem', color: '#cbd5e1' }}>
            <span>{c.icon} {c.name}</span>
            <span>-{c.planned_amount.toLocaleString()} ₽</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="glass-card">
        <h3 className="section-title" style={{ margin: 0, marginBottom: '15px' }}>
          <Calendar size={18} style={{ marginRight: '5px', color: '#3b82f6' }} />Календарь событий
        </h3>
        {sortedRecurring.length > 0 ? sortedRecurring.map(r => {
          const isPast = r.day_of_month < currentDay;
          return (
            <div key={r.id} className="upcoming-event" style={{ opacity: isPast ? 0.5 : 1 }}>
              <div className="event-day" style={{ background: isPast ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.1)' }}>
                {isPast ? '✅' : r.day_of_month}
              </div>
              <div className="event-info">
                <div className="event-name">{r.name}</div>
                <div className="event-type">{r.type === 'income' ? 'Поступление' : 'Списание'} • {r.day_of_month}-го</div>
              </div>
              <div className={r.type === 'income' ? 'income' : 'expense'} style={{ fontWeight: 700 }}>
                {r.type === 'income' ? '+' : '-'}{r.amount.toLocaleString()} ₽
              </div>
            </div>
          );
        }) : <div style={{ textAlign: 'center', opacity: 0.5 }}>Нет регулярных событий</div>}
      </div>
    </div>
  );
}
