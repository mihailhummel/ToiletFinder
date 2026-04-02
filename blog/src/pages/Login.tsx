import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { loginAdmin, checkAdminSession } from "../store";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminSession().then((loggedIn) => {
      if (loggedIn) navigate("/admin");
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const success = await loginAdmin(email, password);
    if (success) {
      navigate("/admin");
    } else {
      setError("Грешен имейл или парола");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="flex flex-col items-center mb-8">
          <img src="/blog-logo.png" alt="Toaletna.com logo" className="w-16 h-16 rounded-full object-cover mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Админ Вход</h1>
          <p className="text-gray-500 text-center mt-2">
            Въведете данните за достъп до контролния панел на блога.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Имейл
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="admin@toaletna.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Парола
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="••••••••"
              required
            />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <LogIn size={20} />
            {loading ? "Зареждане..." : "Вход"}
          </button>
        </form>
      </div>
    </div>
  );
}
