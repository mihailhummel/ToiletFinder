import { MapPin } from "lucide-react";

export const Ad1 = ({ className = "" }: { className?: string }) => (
  <div className={`bg-white border border-gray-200 flex flex-col items-center justify-center text-gray-400 p-4 rounded-xl relative overflow-hidden group ${className}`}>
    <div className="absolute inset-0 bg-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
    <span className="text-xs uppercase tracking-widest mb-4">Реклама</span>
    <MapPin size={32} className="mb-4 text-blue-200" />
    <p className="text-center text-sm font-medium">Открийте най-близката тоалетна сега!</p>
    <a href="https://toaletna.com" target="_blank" rel="noopener noreferrer" className="mt-6 bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition-colors z-10">
      Към Картата
    </a>
  </div>
);

export const Ad2 = ({ className = "" }: { className?: string }) => (
  <div className={`bg-white border border-gray-200 flex flex-col items-center justify-center text-gray-400 p-4 rounded-xl relative overflow-hidden group ${className}`}>
    <div className="absolute inset-0 bg-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
    <span className="text-xs uppercase tracking-widest mb-4">Реклама</span>
    <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
      <MapPin size={40} className="text-blue-600" />
    </div>
    <p className="text-center text-sm font-bold text-gray-800 mb-2">Toaletna.com</p>
    <p className="text-center text-xs text-gray-500 mb-6">Твоят верен спътник в нужда.</p>
    <a href="https://toaletna.com" target="_blank" rel="noopener noreferrer" className="bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-gray-800 transition-colors z-10">
      Изтегли / Отвори
    </a>
  </div>
);
