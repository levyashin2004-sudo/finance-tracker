import React, { useState } from 'react';
import './index.css';
import './layout.css';
import DashboardTab from './components/DashboardTab';
import TransactionsTab from './components/TransactionsTab';
import BudgetsTab from './components/BudgetsTab';
import ForecastTab from './components/ForecastTab';
import GoalsTab from './components/GoalsTab';
import CapitalTab from './components/CapitalTab';
import FamilyTab from './components/FamilyTab';
import SettingsTab from './components/SettingsTab';
import { LayoutDashboard, Receipt, PieChart, TrendingUp, Target, Briefcase, Users, Settings } from 'lucide-react';

const TABS = [
  { id: 'dashboard', label: 'Сводка', icon: LayoutDashboard },
  { id: 'transactions', label: 'Операции', icon: Receipt },
  { id: 'budgets', label: 'Бюджеты', icon: PieChart },
  { id: 'forecast', label: 'Прогноз', icon: TrendingUp },
  { id: 'goals', label: 'Цели', icon: Target },
  { id: 'capital', label: 'Капитал', icon: Briefcase },
  { id: 'family', label: 'Группа', icon: Users },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab />;
      case 'transactions': return <TransactionsTab />;
      case 'budgets': return <BudgetsTab />;
      case 'forecast': return <ForecastTab />;
      case 'goals': return <GoalsTab />;
      case 'capital': return <CapitalTab />;
      case 'family': return <FamilyTab />;
      case 'settings': return <SettingsTab />;
      default: return <DashboardTab />;
    }
  };

  return (
    <div className="app-layout">
      <div className="tab-container">
        {renderTab()}
      </div>
      <nav className="bottom-nav">
        {TABS.map(tab => (
          <button key={tab.id} className={`nav-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
