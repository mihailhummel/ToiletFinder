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
      {/* Globe icon - always visible */}
      <Globe className="w-4 h-4 text-gray-500 mr-2" />
      
      {/* Language toggle buttons - separate style to match original */}
      <div className="flex items-center space-x-1">
        <button
          onClick={() => handleLanguageClick('bg')}
          className={`px-2 py-1 text-xs font-medium rounded transition-all ${
            language === 'bg' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          BG
        </button>
        <button
          onClick={() => handleLanguageClick('en')}
          className={`px-2 py-1 text-xs font-medium rounded transition-all ${
            language === 'en' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          EN
        </button>
      </div>
    </div>
  );
};