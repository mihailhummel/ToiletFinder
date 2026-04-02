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

if (gaMeasurementId && import.meta.env.MODE !== "development") {
  ReactGA.initialize(gaMeasurementId);
}

function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    if (gaMeasurementId && import.meta.env.MODE !== "development") {
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
