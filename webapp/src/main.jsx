import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Intercept fetch to automatically include the Telegram User ID (for multi-family isolation)
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  
  // Extract Telegram ID if inside Telegram Mini App
  const initData = window.Telegram?.WebApp?.initDataUnsafe;
  let telegramId = initData?.user?.id;
  
  // Desktop Shortcut Fallback via URL Params
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('desktop_user')) {
      telegramId = urlParams.get('desktop_user');
      localStorage.setItem('saved_desktop_user', telegramId);
  } else if (!telegramId) {
      telegramId = localStorage.getItem('saved_desktop_user') || 'ANONYMOUS_DESKTOP';
  }

  config = config || {};
  config.headers = {
    ...config.headers,
    'X-Telegram-ID': telegramId
  };
  
  return originalFetch(resource, config);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
