import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import ReactGA from "react-ga4";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Post from "./pages/Post";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
// ADSENSE: consent plumbing. Remove these two imports and their uses below.
import { hasAnalyticsConsent } from "./lib/cmp";
import AnalyticsConsentBanner from "./components/AnalyticsConsentBanner";
import ScrollToTop from "./components/ScrollToTop";

const basePath = import.meta.env.VITE_BASE_PATH || "/blog";
const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

// The blog is served same-origin (/blog), so it shares the main app's cookie
// consent decision in localStorage. Only load Google Analytics if the visitor
// has accepted — otherwise no tracking (GDPR/ePrivacy hard-gate). That decision
// comes from a cookie banner (this app's AnalyticsConsentBanner, or the map's),
// never from Google's CMP, which covers advertising only. This is
// re-evaluated on CONSENT_EVENT rather than read once at module load: on a first
// visit the CMP resolves *after* this module is imported, so a module-scope
// check would leave analytics off for the whole session.
const analyticsPossible =
  !!gaMeasurementId && import.meta.env.MODE !== "development";

let gaInitialized = false;

function analyticsAllowed(): boolean {
  return analyticsPossible && hasAnalyticsConsent();
}

function ensureGaInitialized(): boolean {
  if (!analyticsAllowed()) return false;
  if (!gaInitialized) {
    ReactGA.initialize(gaMeasurementId);
    gaInitialized = true;
  }
  return true;
}

function AppRoutes() {
  const location = useLocation();

  // Re-send the pending pageview if consent lands after the route rendered.
  useEffect(() => {
    const onConsentChange = () => {
      if (ensureGaInitialized()) {
        ReactGA.send({ hitType: "pageview", page: window.location.pathname });
      }
    };
    window.addEventListener("toaletna-consent-change", onConsentChange);
    return () => window.removeEventListener("toaletna-consent-change", onConsentChange);
  }, []);

  useEffect(() => {
    if (ensureGaInitialized()) {
      ReactGA.send({ hitType: "pageview", page: location.pathname });
    }
  }, [location]);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path=":slug" element={<Post />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter basename={basePath}>
        {/* Must sit inside the router: every route change starts at the top. */}
        <ScrollToTop />
        <AppRoutes />
        {/* ADSENSE: analytics consent. Google's CMP covers advertising separately. */}
        <AnalyticsConsentBanner />
      </BrowserRouter>
    </HelmetProvider>
  );
}
