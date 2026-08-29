import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
// ADSENSE: boots Google's Funding Choices CMP, which is the consent source for
// both ads and analytics. No-ops unless VITE_ADS_ENABLED=true.
import { initCmp } from './lib/cmp';

initCmp();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
