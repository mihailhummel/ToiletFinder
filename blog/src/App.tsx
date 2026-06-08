import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import ReactGA from "react-ga4";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Post from "./pages/Post";
import Login from "./pages/Login";
import Admin from "./pages/Admin";

const basePath = import.meta.env.VITE_BASE_PATH || "/blog";
const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

// The blog is served same-origin (/blog), so it shares the main app's cookie
// consent decision in localStorage. Only load Google Analytics if the visitor
// has accepted — otherwise no tracking (GDPR/ePrivacy hard-gate). To change the
// choice, use the cookie settings on the main site.
function hasAnalyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem("toaletna-cookie-consent");
    if (!raw) return false;
    const c = JSON.parse(raw);
    return c?.status === "accepted" && (c?.version ?? 0) >= 1;
  } catch {
    return false;
  }
}

const analyticsAllowed =
  !!gaMeasurementId && import.meta.env.MODE !== "development" && hasAnalyticsConsent();

if (analyticsAllowed) {
  ReactGA.initialize(gaMeasurementId);
}

function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    if (analyticsAllowed) {
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
        <AppRoutes />
      </BrowserRouter>
    </HelmetProvider>
  );
}
