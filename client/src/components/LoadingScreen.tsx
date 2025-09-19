import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface LoadingScreenProps {
  isLoading: boolean;
  toiletCount?: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ isLoading, toiletCount }) => {
  const { t } = useLanguage();
  
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-white bg-opacity-95 backdrop-blur-sm z-[2000] flex flex-col">
      {/* Main loading content - centered */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-8">
          {/* Loading Animation */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-4 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🚽</span>
            </div>
          </div>
          
          {/* Loading Text */}
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {t('loading.toilets')}
          </h2>
          
          <p className="text-gray-600 mb-4">
            {t('loading.message')}
          </p>
          
          {/* {toiletCount && toiletCount > 0 && (
            <div className="bg-blue-50 rounded-lg p-4 inline-block">
              <p className="text-blue-700 font-medium">
                📍 {toiletCount.toLocaleString()} {t('loading.count')}
              </p>
            </div>
          )}
          
          <p className="text-xs text-gray-500 mt-4">
            {t('loading.oneTime')}
          </p> */}
        </div>
      </div>
      
      {/* Studio logo at bottom center */}
      <div className="flex justify-center pb-8 px-4">
        <img 
          src="/PF_Logo_transp.png" 
          alt="Phygital Factory Studio Logo" 
          className="opacity-100 max-w-[40%] h-auto 
                     w-auto max-h-20 
                     sm:max-h-16 sm:max-w-[25%] 
                     md:max-h-18 md:max-w-[20%] 
                     lg:max-h-20 lg:max-w-[15%] 
                     xl:max-h-24 xl:max-w-[12%]"
        />
      </div>
    </div>
  );
};