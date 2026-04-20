import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';

export default function SettingsTab() {
  const [categories, setCategories] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);

  const myTgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || localStorage.getItem('saved_desktop_user') || '';

  const fetchData = () => {
    fetch('/api/categories').then(r=>r.json()).then(setCategories);
    fetch('/api/recurring').then(r=>r.json()).then(setRecurring);
    fetch('/api/wallets').then(r=>r.json()).then(setWallets);
    fetch('/api/family').then(r=>r.json()).then(setFamilyMembers);
  };

  useEffect(() => { fetchData(); }, []);

  // ---- CATEGORIES ----
  const addCategory = () => {
    const name = prompt("Название категории");
    if (!name) return;
    const icon = prompt("Эмодзи", "📁");
    const type = prompt("Тип: income или expense?", "expense");
    if (type !== 'income' && type !== 'expense') return alert('Тип должен быть income или expense');
    const is_mandatory = window.confirm("Это обязательная трата? (ОК — Да)") ? 1 : 0;
    
    let planned_amount = 0;
    if (type === 'expense') {
        const amt = prompt("Лимит трат в месяц? (0 = без лимита)", "0");
        planned_amount = parseFloat(amt) || 0;
    }
    
    fetch('/api/categories', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name, icon, type, is_mandatory, planned_amount})
    }).then(fetchData);
  };

  const editCategory = (c) => {
      const name = prompt(`Название:`, c.name);
      if (!name) return;
      let planned_amount = c.planned_amount || 0;
      if (c.type === 'expense') {
          const amt = prompt(`Лимит (было ${planned_amount}₽):`, planned_amount);
          planned_amount = parseFloat(amt) || 0;
      }
      fetch(`/api/categories/${c.id}`, {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({name, planned_amount})
      }).then(fetchData);
  };

  const deleteCategory = (id) => {
    if (!window.confirm('Удалить категорию?')) return;
    fetch(`/api/categories/${id}`, {method:'DELETE'}).then(fetchData);
  };

  // ---- WALLETS ----
  const addWallet = () => {
    const name = prompt("Название кошелька (Карта Тинькофф, Наличные и т.д.)");
    if (!name) return;
    const icon = prompt("Эмодзи", "💳");
    const amountStr = prompt("Начальный баланс", "0");
    const amount = parseFloat(amountStr) || 0;
    
    fetch('/api/wallets', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name, icon, amount})
    }).then(fetchData);
  };

  const editWallet = (w) => {
    const amountStr = prompt(`Новый баланс для "${w.name}" (сейчас ${w.amount}₽):`, w.amount);
    if (amountStr === null) return;
    fetch(`/api/wallets/${w.id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({amount: parseFloat(amountStr) || 0})
    }).then(fetchData);
  };

  const deleteWallet = (id) => {
    if (!window.confirm('Удалить кошелёк? Все транзакции, привязанные к нему, останутся.')) return;
    fetch(`/api/wallets/${id}`, {method:'DELETE'}).then(fetchData);
  };

  // ---- RECURRING ----
  const addRecurring = () => {
      const name = prompt("Название (Зарплата, Аренда...)");
      if (!name) return;
      const amount = prompt("Сумма");
      const day_of_month = prompt("День месяца (1-31)");
      const type = prompt("Тип: income или expense?", "expense");
      if (type !== 'income' && type !== 'expense') return alert('income или expense');
      
      const filteredCats = categories.filter(c => c.type === type);
      let category_id = null;
      if (filteredCats.length > 0) {
          const catStr = prompt('Категория (номер):\\n' + filteredCats.map((c, i) => `${i+1} — ${c.icon||'📁'} ${c.name}`).join('\\n'));
          if (catStr) category_id = filteredCats[parseInt(catStr)-1]?.id || null;
      }

      let wallet_id = null;
      if (wallets.length > 0) {
          const walStr = prompt('Кошелёк (номер):\\n' + wallets.map((w, i) => `${i+1} — ${w.icon||'💳'} ${w.name}`).join('\\n'));
          if (walStr) wallet_id = wallets[parseInt(walStr)-1]?.id || null;
      }

      if (name && amount && day_of_month && type) {
          fetch('/api/recurring', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                  name, 
                  amount: parseFloat(amount), 
                  day_of_month: parseInt(day_of_month), 
                  type,
                  category_id,
                  wallet_id,
                  user_id: parseInt(myTgId) || null
              })
          }).then(fetchData);
      }
  };

  const editRecurring = (r) => {
      const name = prompt("Название:", r.name);
      if (!name) return;
      const amount = prompt("Сумма:", r.amount);
      const day_of_month = prompt("День месяца:", r.day_of_month);
      if (amount && day_of_month) {
          fetch(`/api/recurring/${r.id}`, {
              method: 'PUT',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({name, amount: parseFloat(amount), day_of_month: parseInt(day_of_month)})
          }).then(fetchData);
      }
  };

  const deleteRecurring = (id) => {
      if (!window.confirm('Удалить регулярный платёж?')) return;
      fetch(`/api/recurring/${id}`, {method: 'DELETE'}).then(fetchData);
  };

  const expenseCats = categories.filter(c => c.type === 'expense');
  const incomeCats = categories.filter(c => c.type === 'income');

  return (
    <div className="tab-pane">
        <h2 className="section-title">Настройки</h2>

        {/* СЕМЬЯ */}
        <div className="glass-card" style={{borderColor: 'rgba(16, 185, 129, 0.2)'}}>
            <h3 className="section-title" style={{margin:0, marginBottom:'12px', color:'#10b981', fontSize:'1rem'}}>👨‍👩‍👧 Участники семьи</h3>
            
            <div style={{background: 'rgba(16, 185, 129, 0.08)', padding: '10px 14px', borderRadius: '10px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                    <div style={{fontSize: '0.75rem', color: '#10b981', fontWeight: 600}}>Ваш ID для приглашений:</div>
                    <div style={{fontSize: '1.1rem', fontFamily: 'monospace', marginTop: '2px'}}>{myTgId || '—'}</div>
                </div>
                <button className="add-btn-small" style={{fontSize: '0.75rem', padding: '5px 10px'}} onClick={() => {
                    if (myTgId) { navigator.clipboard.writeText(myTgId.toString()); alert('Скопировано: ' + myTgId); }
                }}>📋</button>
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                {familyMembers.map((m, idx) => (
                    <div key={idx} style={{display:'flex', alignItems:'center', gap:'10px', background:'rgba(255,255,255,0.04)', padding:'8px 12px', borderRadius:'10px'}}>
                        <div style={{width:'28px', height:'28px', borderRadius:'50%', background:'#334155', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.8rem', fontWeight:600}}>
                            {m.first_name ? m.first_name[0].toUpperCase() : '?'}
                        </div>
                        <div>
                            <div style={{fontSize:'0.9rem', fontWeight:500}}>{m.first_name || 'Участник'}</div>
                            <div style={{fontSize:'0.7rem', color:'#64748b'}}>{m.username ? `@${m.username}` : `ID: ${m.telegram_id}`}</div>
                        </div>
                    </div>
                ))}
            </div>

            <button className="action-btn" style={{marginTop: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981'}} onClick={() => {
                const code = prompt("Введите ID семьи, к которой хотите присоединиться:");
                if (code) {
                    fetch('/api/family/join', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ inviteCode: code })
                    }).then(() => { alert("Готово! Перезагрузка..."); window.location.reload(); });
                }
            }}>
                Присоединиться к семье по ID
            </button>
        </div>

        {/* КОШЕЛЬКИ */}
        <div className="glass-card">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px'}}>
                <h3 className="section-title" style={{margin:0, fontSize:'1rem'}}>💳 Кошельки (Счета)</h3>
                <button className="add-btn-small" onClick={addWallet}><Plus size={14}/></button>
            </div>
            {wallets.length === 0 && <p style={{opacity:0.4, fontSize:'0.85rem', textAlign:'center'}}>Нет кошельков</p>}
            {wallets.map(w => (
                <div className="tx-item" key={w.id}>
                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                        <span style={{fontSize:'1.2rem'}}>{w.icon || '💳'}</span>
                        <span style={{fontWeight:500}}>{w.name}</span>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                        <strong style={{color:'#10b981'}}>{(w.amount||0).toLocaleString()} ₽</strong>
                        <button className="add-btn-small" style={{padding:'3px 5px'}} onClick={() => editWallet(w)}><Edit2 size={12}/></button>
                        <button className="delete-btn" style={{padding:'3px 5px'}} onClick={() => deleteWallet(w.id)}><Trash2 size={12}/></button>
                    </div>
                </div>
            ))}
        </div>

        {/* КАТЕГОРИИ */}
        <div className="glass-card">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px'}}>
                <h3 className="section-title" style={{margin:0, fontSize:'1rem'}}>📂 Категории</h3>
                <button className="add-btn-small" onClick={addCategory}><Plus size={14}/></button>
            </div>
            
            {expenseCats.length > 0 && (
                <>
                    <div style={{fontSize:'0.75rem', color:'#f43f5e', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px', marginTop:'5px'}}>Расходы</div>
                    {expenseCats.map(c => (
                        <div className="tx-item" key={c.id} style={{marginBottom:'6px'}}>
                            <div style={{display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap'}}>
                                <span>{c.icon}</span> 
                                <span style={{fontWeight:500}}>{c.name}</span>
                                {c.is_mandatory === 1 && <span className="mandatory-badge">Обяз.</span>}
                                {c.planned_amount > 0 && <span style={{fontSize:'0.7rem', color:'#fbbf24'}}>Лимит: {c.planned_amount.toLocaleString()}₽</span>}
                            </div>
                            <div style={{display:'flex', gap:'4px'}}>
                                <button className="add-btn-small" style={{padding:'3px 5px'}} onClick={() => editCategory(c)}>✎</button>
                                <button className="delete-btn" style={{padding:'3px 5px'}} onClick={() => deleteCategory(c.id)}><Trash2 size={12}/></button>
                            </div>
                        </div>
                    ))}
                </>
            )}

            {incomeCats.length > 0 && (
                <>
                    <div style={{fontSize:'0.75rem', color:'#10b981', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px', marginTop:'15px'}}>Доходы</div>
                    {incomeCats.map(c => (
                        <div className="tx-item" key={c.id} style={{marginBottom:'6px'}}>
                            <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                                <span>{c.icon}</span> <span style={{fontWeight:500}}>{c.name}</span>
                            </div>
                            <div style={{display:'flex', gap:'4px'}}>
                                <button className="add-btn-small" style={{padding:'3px 5px'}} onClick={() => editCategory(c)}>✎</button>
                                <button className="delete-btn" style={{padding:'3px 5px'}} onClick={() => deleteCategory(c.id)}><Trash2 size={12}/></button>
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>

        {/* РЕГУЛЯРНЫЕ ПЛАТЕЖИ */}
        <div className="glass-card">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px'}}>
                <h3 className="section-title" style={{margin:0, fontSize:'1rem'}}>🔄 Регулярные платежи</h3>
                <button className="add-btn-small" onClick={addRecurring}><Plus size={14}/></button>
            </div>
            {recurring.length === 0 && <p style={{opacity:0.4, fontSize:'0.85rem', textAlign:'center'}}>Нет регулярных платежей</p>}
            {recurring.map(r => (
                <div className="tx-item" key={r.id} style={{marginBottom:'8px'}}>
                    <div>
                        <div style={{fontWeight:500}}>{r.type === 'income' ? '💰' : '💳'} {r.name}</div>
                        <div style={{fontSize:'0.75rem', color:'#64748b'}}>Каждого {r.day_of_month}-го числа</div>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                        <strong className={r.type === 'income' ? 'income' : 'expense'}>{r.type === 'income' ? '+' : '-'}{(r.amount||0).toLocaleString()} ₽</strong>
                        <button className="add-btn-small" style={{padding:'3px 5px'}} onClick={() => editRecurring(r)}>✎</button>
                        <button className="delete-btn" style={{padding:'3px 5px'}} onClick={() => deleteRecurring(r.id)}><Trash2 size={12}/></button>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}
