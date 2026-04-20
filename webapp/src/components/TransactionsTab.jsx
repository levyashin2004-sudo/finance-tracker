import React, { useEffect, useState } from 'react';
import { Trash2, Search, Filter, X, ArrowRightLeft } from 'lucide-react';

export default function TransactionsTab() {
  const [transactions, setTransactions] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterWallet, setFilterWallet] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = () => {
    fetch('/api/transactions').then(r => r.json()).then(setTransactions);
    fetch('/api/transfers').then(r => r.json()).then(setTransfers);
    fetch('/api/categories').then(r => r.json()).then(setCategories);
    fetch('/api/wallets').then(r => r.json()).then(setWallets);
  };

  useEffect(() => { fetchData(); }, []);

  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  const handleDelete = (id) => {
    if (!window.confirm('Удалить операцию?')) return;
    fetch(`/api/transactions/${id}`, { method: 'DELETE' }).then(fetchData);
  };

  const handleDeleteTransfer = (id) => {
    if (!window.confirm('Отменить перевод?')) return;
    fetch(`/api/transfers/${id}`, { method: 'DELETE' }).then(fetchData);
  };

  // Filter transactions
  let filtered = transactions.filter(t => {
    const d = new Date(t.date);
    if (d.getMonth() !== parseInt(selectedMonth) || d.getFullYear() !== parseInt(selectedYear)) return false;
    if (filterType !== 'all' && t.category_type !== filterType) return false;
    if (filterCategory !== 'all' && t.category_name !== filterCategory) return false;
    if (filterWallet !== 'all' && t.wallet_name !== filterWallet) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = (t.category_name || '').toLowerCase().includes(q);
      const matchDesc = (t.description || '').toLowerCase().includes(q);
      const matchUser = (t.user_name || '').toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchUser) return false;
    }
    return true;
  });

  const filteredIncome = filtered.filter(t => t.category_type === 'income').reduce((a, t) => a + t.amount, 0);
  const filteredExpense = filtered.filter(t => t.category_type === 'expense').reduce((a, t) => a + t.amount, 0);

  // Group by day
  const grouped = {};
  filtered.forEach(t => {
    const day = new Date(t.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(t);
  });

  // Filter transfers for the month
  const filteredTransfers = transfers.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === parseInt(selectedYear);
  });

  const uniqueCatNames = [...new Set(transactions.map(t => t.category_name).filter(Boolean))];
  const uniqueWalletNames = [...new Set(wallets.map(w => w.name).filter(Boolean))];

  return (
    <div className="tab-pane">
      <h2 className="section-title">Журнал операций</h2>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        <select className="ui-select" style={{ flex: 1 }} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
          {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select className="ui-select" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
          <option value="2026">2026</option>
          <option value="2025">2025</option>
        </select>
      </div>

      {/* Search */}
      <div className="search-bar">
        <Search size={16} className="search-icon" />
        <input type="text" placeholder="Поиск по описанию, категории..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)} className="search-input" />
        <button className="filter-toggle" onClick={() => setShowFilters(!showFilters)}>
          <Filter size={16} />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="glass-card filters-panel" style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select className="ui-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">Все типы</option>
              <option value="income">Доходы</option>
              <option value="expense">Расходы</option>
            </select>
            <select className="ui-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="all">Все категории</option>
              {uniqueCatNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select className="ui-select" value={filterWallet} onChange={e => setFilterWallet(e.target.value)}>
              <option value="all">Все кошельки</option>
              {uniqueWalletNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', padding: '14px', marginTop: '12px' }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Доход</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#10b981' }}>+{filteredIncome.toLocaleString()} ₽</div>
        </div>
        <div style={{ width: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Расход</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f43f5e' }}>-{filteredExpense.toLocaleString()} ₽</div>
        </div>
        <div style={{ width: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Итого</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: (filteredIncome - filteredExpense) >= 0 ? '#10b981' : '#f43f5e' }}>
            {(filteredIncome - filteredExpense) > 0 ? '+' : ''}{(filteredIncome - filteredExpense).toLocaleString()} ₽
          </div>
        </div>
      </div>

      {/* Transaction List grouped by day */}
      {Object.keys(grouped).length === 0 && (
        <div style={{ textAlign: 'center', opacity: 0.4, padding: '40px 0' }}>Транзакций не найдено</div>
      )}
      {Object.entries(grouped).map(([day, txs]) => (
        <div key={day} style={{ marginTop: '16px' }}>
          <div className="day-header">{day}</div>
          {txs.map(t => (
            <div className="tx-item" key={t.id}>
              <div className="tx-left">
                <div className="tx-icon">{t.category_icon || '📁'}</div>
                <div className="tx-details">
                  <h4>{t.category_name} {t.is_mandatory === 1 && <span className="mandatory-badge">Обяз.</span>}</h4>
                  <div>
                    <span className="user-badge">{t.user_name || 'Семья'}</span>
                    {t.wallet_name && <span style={{ color: '#64748b' }}> • {t.wallet_name}</span>}
                    {t.description && <span style={{ color: '#f59e0b' }}> • {t.description}</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className={`tx-amount ${t.category_type === 'income' ? 'income' : 'expense'}`}>
                  {t.category_type === 'income' ? '+' : '-'}{t.amount.toLocaleString()} ₽
                </div>
                <button className="delete-btn" onClick={() => handleDelete(t.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Transfers section */}
      {filteredTransfers.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div className="day-header"><ArrowRightLeft size={14} style={{ marginRight: '6px' }} />Переводы между счетами</div>
          {filteredTransfers.map(t => (
            <div className="tx-item" key={`tr-${t.id}`}>
              <div className="tx-left">
                <div className="tx-icon">↔</div>
                <div className="tx-details">
                  <h4>{t.from_wallet_name} → {t.to_wallet_name}</h4>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{new Date(t.date).toLocaleDateString('ru-RU')}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="tx-amount" style={{ color: '#a5b4fc' }}>{t.amount.toLocaleString()} ₽</div>
                <button className="delete-btn" onClick={() => handleDeleteTransfer(t.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CSV Export */}
      <div style={{ textAlign: 'center', marginTop: '20px', paddingBottom: '10px' }}>
        <a href="/api/export/csv" className="transfer-btn" style={{ textDecoration: 'none', display: 'inline-flex' }}>
          📥 Скачать CSV
        </a>
      </div>
    </div>
  );
}
