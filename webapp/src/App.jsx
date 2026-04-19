import React, { useState } from 'react';
import './index.css';
import './layout.css';
import MainTab from './components/MainTab';
import BalanceTab from './components/BalanceTab';
import CapitalTab from './components/CapitalTab';
import SettingsTab from './components/SettingsTab';
import GoalsTab from './components/GoalsTab';
import ForecastTab from './components/ForecastTab';
import { LayoutDashboard, Wallet, Briefcase, Settings, Target, Calendar } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('main');

  return (
    <div className="app-layout">
      {/* Dynamic Content Area */}
      <div className="tab-container">
        {activeTab === 'main' && <MainTab />}
        {activeTab === 'balance' && <BalanceTab />}
        {activeTab === 'forecast' && <ForecastTab />}
        {activeTab === 'capital' && <CapitalTab />}
        {activeTab === 'goals' && <GoalsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>

      {/* Bottom Navigation Bar */}
      <nav className="bottom-nav">
        <button className={`nav-item ${activeTab === 'main' ? 'active' : ''}`} onClick={() => setActiveTab('main')}>
          <LayoutDashboard size={22} />
          <span>Сводка</span>
        </button>
        <button className={`nav-item ${activeTab === 'balance' ? 'active' : ''}`} onClick={() => setActiveTab('balance')}>
          <Wallet size={22} />
          <span>Баланс</span>
        </button>
        <button className={`nav-item ${activeTab === 'forecast' ? 'active' : ''}`} onClick={() => setActiveTab('forecast')}>
          <Calendar size={22} />
          <span>Прогноз</span>
        </button>
        <button className={`nav-item ${activeTab === 'goals' ? 'active' : ''}`} onClick={() => setActiveTab('goals')}>
          <Target size={22} />
          <span>Цели</span>
        </button>
        <button className={`nav-item ${activeTab === 'capital' ? 'active' : ''}`} onClick={() => setActiveTab('capital')}>
          <Briefcase size={22} />
          <span>Капитал</span>
        </button>
        <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <Settings size={22} />
          <span>Настройки</span>
        </button>
      </nav>
    </div>
  );
}
