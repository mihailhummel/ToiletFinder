import { Outlet, Link } from "react-router-dom";
import { MapPin, LogIn, Mail, ArrowRight } from "lucide-react";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100 text-gray-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-slate-800 hover:text-slate-700 transition-colors">
            <img src="/blog-logo.png" alt="Toaletna.com logo" className="h-9 w-9 rounded-lg object-cover" />
            Toaletna.com <span className="text-gray-400 font-light">| БЛОГ</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <a href="https://toaletna.com" target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full font-medium transition-colors shadow-sm">
              <MapPin size={18} />
              Посетете нашата карта
            </a>
            <a href="https://toaletna.com" target="_blank" rel="noopener noreferrer" className="sm:hidden flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full transition-colors shadow-sm" title="Посетете нашата карта">
              <MapPin size={18} />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-16 mt-auto border-t-4 border-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            
            {/* Brand & Contact */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-2xl font-bold text-white mb-2">
                <img src="/blog-logo.png" alt="Toaletna.com logo" className="h-10 w-10 rounded-xl object-cover" />
                Toaletna.com
              </div>
              <p className="text-gray-400 leading-relaxed">
                Твоят верен спътник в нужда. Намираме най-близките и чисти тоалетни около теб.
              </p>
              <a href="mailto:contact@toaletna.com" className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mt-2 w-fit">
                <Mail size={18} className="text-blue-500" />
                contact@toaletna.com
              </a>
            </div>

            {/* Quick Links */}
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-bold text-white mb-2">Бързи Връзки:</h3>
              <Link to="/" className="hover:text-blue-400 transition-colors w-fit">Начало Блог</Link>
              {/* <Link to="/login" className="flex items-center gap-2 hover:text-blue-400 transition-colors w-fit">
                <LogIn size={16} />
                Вход за администратори
              </Link> */}
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-4 items-start md:items-end">
              <h3 className="text-lg font-bold text-white mb-2">Изпаднал си в нужда?</h3>
              <p className="text-gray-400 text-left md:text-right mb-2">
                Използвай нашата интерактивна карта, за да намериш най-близката тоалетна до теб.
              </p>
              <a href="https://toaletna.com" target="_blank" rel="noopener noreferrer" className="group relative inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:-translate-y-1 overflow-hidden">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <MapPin size={22} className="relative z-10" />
                <span className="relative z-10">Отвори Картата</span>
                <ArrowRight size={22} className="relative z-10 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>

          </div>
          
          <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
            <div>
              &copy; {new Date().getFullYear()} Toaletna.com. Всички права запазени.
            </div>
            <div className="flex items-center gap-4">
              <span className="hover:text-gray-300 cursor-pointer transition-colors">Общи условия</span>
              <span className="hover:text-gray-300 cursor-pointer transition-colors">Поверителност</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
