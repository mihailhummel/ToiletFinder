import React from 'react';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

interface LanguageSwitchProps {
  className?: string;
}

export const LanguageSwitch: React.FC<LanguageSwitchProps> = ({ className = '' }) => {
  const { language, changeLanguage } = useLanguage();

  const handleLanguageClick = (lang: Language) => {
    changeLanguage(lang);
  };

  const getTooltip = () => {
    return language === 'en' 
      ? 'Switch to Bulgarian' 
      : 'Превключи на английски';
  };

  return (
    <div className={`flex items-center ${className}`} title={getTooltip()}>
      {/* Globe icon - hidden on mobile and tablets */}
      <Globe className="w-4 h-4 text-gray-500 hidden lg:block mr-1" />
      
      {/* Responsive toggle with better sizing */}
      <div className="flex items-center bg-gray-100 rounded p-0.5 sm:p-1">
        <button
          onClick={() => handleLanguageClick('bg')}
          className={`language-toggle-btn px-1.5 py-0.5 sm:px-2 sm:py-1 text-xs font-medium rounded transition-all flex items-center justify-center min-w-[28px] sm:min-w-[32px] ${
            language === 'bg' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          BG
        </button>
        <span className="text-gray-400 mx-0.5 sm:mx-1 text-xs">|</span>
        <button
          onClick={() => handleLanguageClick('en')}
          className={`language-toggle-btn px-1.5 py-0.5 sm:px-2 sm:py-1 text-xs font-medium rounded transition-all flex items-center justify-center min-w-[28px] sm:min-w-[32px] ${
            language === 'en' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          EN
        </button>
      </div>
    </div>
  );
};