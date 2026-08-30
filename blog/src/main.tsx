import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
// ADSENSE: boots Google's Funding Choices CMP, the consent source for
// ADVERTISING only — analytics consent comes from AnalyticsConsentBanner.
// No-ops unless VITE_ADS_ENABLED=true.
import { initCmp } from './lib/cmp';

initCmp();

// Take scroll restoration away from the browser. ScrollToTop does it instead:
// the browser restores as soon as a history entry is applied, which in an SPA is
// before the post has loaded, so it lands in the wrong place. Ours waits for the
// content. This also makes a hard refresh start at the top.
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
