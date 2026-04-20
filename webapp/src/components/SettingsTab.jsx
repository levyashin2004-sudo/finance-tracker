import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export default function SettingsTab() {
  const [categories, setCategories] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [wallets, setWallets] = useState([]);

  const fetchData = () => {
    fetch('/api/categories').then(r=>r.json()).then(setCategories);
    fetch('/api/recurring').then(r=>r.json()).then(setRecurring);
    fetch('/api/wallets').then(r=>r.json()).then(setWallets);
  };

  useEffect(() => { fetchData(); }, []);

  const addCategory = () => {
    const name = prompt("Название категории");
    if (!name) return;
    const icon = prompt("Эмодзи", "💵");
    const type = prompt("Тип: income (доход) или expense (расход)?", "expense");
    const is_mandatory = window.confirm("Это обязательная трата/доход? (ОК - Да, Отмена - Нет)") ? 1 : 0;
    
    let planned_amount = 0;
    if (type === 'expense') {
        const amt = prompt("Лимит трат в месяц на эту категорию? (Введите 0, если лимита нет)");
        planned_amount = parseFloat(amt) || 0;
    }
    
    if(name && type) {
        fetch('/api/categories', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, icon, type, is_mandatory, planned_amount})
        }).then(fetchData);
    }
  };

  const editCategory = (c) => {
      const name = prompt(`Новое название для "${c.name}" (оставьте пустым для отмены)`, c.name);
      if (!name) return;
      
      let planned_amount = c.planned_amount || 0;
      if (c.type === 'expense') {
          const amt = prompt(`Лимит трат в месяц? (Было ${planned_amount}₽)`, planned_amount);
          planned_amount = parseFloat(amt) || 0;
      }
      
      fetch(`/api/categories/${c.id}`, {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({name, planned_amount})
      }).then(fetchData);
  };

  const deleteCategory = (id) => {
    fetch(`/api/categories/${id}`, {method:'DELETE'}).then(fetchData);
  };

  const addRecurring = () => {
      const name = prompt("Название платежа (например, Зарплата Лев, Аренда)");
      if (!name) return;
      const amount = prompt("Сумма платежа");
      const day_of_month = prompt("День месяца? (1-31)");
      const type = prompt("Тип: income (доход) или expense (расход)?", "expense");
      
      const catIdStr = prompt('ID Категории? (Введите число):\n' + categories.filter(c => c.type === type).map(c => `${c.id} - ${c.name}`).join('\n'));
      const walIdStr = prompt('ID Кошелька? (Введите число):\n' + wallets.map(w => `${w.id} - ${w.name}`).join('\n'));

      if (name && amount && day_of_month && type) {
          fetch('/api/recurring', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                  name, 
                  amount: parseFloat(amount), 
                  day_of_month: parseInt(day_of_month), 
                  type,
                  category_id: parseInt(catIdStr)||null,
                  wallet_id: parseInt(walIdStr)||null,
                  user_id: 111111 // Default user for auto payments
              })
          }).then(fetchData);
      }
  };

  const editRecurring = (r) => {
      const name = prompt("Новое название: ", r.name);
      if (!name) return;
      const amount = prompt("Сумма: ", r.amount);
      const day_of_month = prompt("День месяца: ", r.day_of_month);
      
      if (amount && day_of_month) {
          fetch(`/api/recurring/${r.id}`, {
              method: 'PUT',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({name, amount: parseFloat(amount), day_of_month: parseInt(day_of_month)})
          }).then(fetchData);
      }
  };

  const deleteRecurring = (id) => {
      fetch(`/api/recurring/${id}`, {method: 'DELETE'}).then(fetchData);
  };

  return (
    <div className="tab-pane">
        <h2 className="section-title">Настройки системы</h2>

        <div className="glass-card">
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
                <h3 className="section-title" style={{margin:0}}>Категории (Классификатор)</h3>
                <button className="add-btn-small" onClick={addCategory}><Plus size={14}/></button>
            </div>
            
            {categories.map(c => (
                <div className="tx-item" key={c.id}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <span>{c.icon}</span> {c.name}
                        {c.is_mandatory === 1 && <span className="mandatory-badge">Обязательно</span>}
                        {c.planned_amount > 0 && <span style={{fontSize: '0.75rem', color: '#fbbf24', marginLeft: '5px'}}> Лимит: {c.planned_amount.toLocaleString()}₽</span>}
                    </div>
                    <div style={{display: 'flex', alignItems: 'center'}}>
                        <span className="user-badge" style={{marginRight: '10px'}}>{c.type}</span>
                        <button className="add-btn-small" style={{marginRight: '5px', padding: '2px 6px'}} onClick={() => editCategory(c)}>✎</button>
                        <button className="delete-btn" onClick={() => deleteCategory(c.id)}><Trash2 size={16}/></button>
                    </div>
                </div>
            ))}
        </div>

        <div className="glass-card">
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
                <h3 className="section-title" style={{margin:0}}>Регулярные авто-платежи</h3>
                <button className="add-btn-small" onClick={addRecurring}><Plus size={14}/></button>
            </div>
            {recurring.map(r => (
                <div className="tx-item" key={r.id}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        {r.type === 'income' ? '💰' : '💳'} {r.name}
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px'}}>
                        <div className={r.type === 'income' ? 'income' : 'expense'} style={{fontWeight: 600}}>{r.amount.toLocaleString()} ₽</div>
                        <div className="user-badge" style={{fontSize: '0.7rem'}}>Ежемесячно {r.day_of_month}-го числа</div>
                        <div style={{display:'flex', gap:'5px', marginTop:'5px'}}>
                            <button className="add-btn-small" style={{padding: '2px 6px'}} onClick={() => editRecurring(r)}>✎</button>
                            <button className="delete-btn" onClick={() => deleteRecurring(r.id)}><Trash2 size={16}/></button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}
