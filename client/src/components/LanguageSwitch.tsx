import React from 'react';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

interface LanguageSwitchProps {
  className?: string;
}

export const LanguageSwitch: React.FC<LanguageSwitchProps> = ({ className = '' }) => {
  const { language, setLanguage } = useLanguage();

  const handleLanguageClick = (lang: Language) => {
    if (lang !== language) {
      setLanguage(lang);
    }
  };

  const getTooltip = () => {
    return language === 'en' 
      ? 'Switch to Bulgarian' 
      : 'Превключи на английски';
  };

  return (
    <div className={`flex items-center ${className}`} title={getTooltip()}>
      {/* Globe icon - hidden on mobile */}
      <Globe className="w-4 h-4 text-gray-500 hidden md:block mr-1" />
      
      {/* Fixed-size mobile toggle with forced dimensions */}
      <div className="flex items-center bg-gray-100 rounded md:p-1 p-0.5">
        <button
          onClick={() => handleLanguageClick('bg')}
          className={`language-toggle-btn md:px-2 md:py-1 md:text-xs md:w-auto md:h-auto font-medium rounded transition-all flex items-center justify-center ${
            language === 'bg' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          BG
        </button>
        <span className="text-gray-400 md:mx-1 mx-0.5 md:text-xs text-[0.8rem]">|</span>
        <button
          onClick={() => handleLanguageClick('en')}
          className={`language-toggle-btn md:px-2 md:py-1 md:text-xs md:w-auto md:h-auto font-medium rounded transition-all flex items-center justify-center ${
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