import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { store } from './store';
import './styles.css';

if (import.meta.env.DEV) {
  (window as unknown as { __store: typeof store }).__store = store;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
