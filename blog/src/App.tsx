import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Post from "./pages/Post";
import Login from "./pages/Login";
import Admin from "./pages/Admin";

const basePath = import.meta.env.VITE_BASE_PATH || "/blog";

export default function App() {
  return (
    <BrowserRouter basename={basePath}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="post/:id" element={<Post />} />
          <Route path="login" element={<Login />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
