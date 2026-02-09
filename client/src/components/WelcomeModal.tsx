import React from "react";
import { MapPin, Flag, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Welcome Modal - Explains the platform to new users
 * 
 * Shows on first visit only. For development testing:
 * - Ctrl+Shift+W: Show welcome modal
 * - Ctrl+Shift+R: Reset first visit flag
 */

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeModal = ({ isOpen, onClose }: WelcomeModalProps) => {
  const { t } = useLanguage();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto z-[9999] w-full max-w-full mobile:max-h-[85vh] mobile:h-auto mobile:overflow-y-auto"
        style={{
          borderRadius: '20px',
          margin: '0',
          maxWidth: '480px',
          width: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 80px)',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          overflowY: 'auto',
          padding: '1rem'
        }}
      >
        <DialogHeader className="">
          <DialogTitle className="flex space-x-2 text-left">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              <img 
                src="/logo.png" 
                alt="Toilet Map Bulgaria Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="font-semibold text-lg text-gray-900">{t('welcome.title')}</div>
              <div className="text-sm text-gray-600 font-normal">{t('welcome.subtitle')}</div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          {/* Pin explanations */}
          <div className="space-y-2">
            {/* <h3 className="font-semibold text-gray-900 text-sm">{t('welcome.pinTypes')}</h3> */}
            
            {/* Red pin explanation */}
            <div className="flex items-center space-x-2 p-2 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex-shrink-0 mb-4">
                {/* Actual red pin design from map */}
                <div style={{
                  position: 'relative',
                  width: '32px',
                  height: '40px'
                }}>
                  <div style={{
                    position: 'absolute',
                    bottom: '0',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '28px',
                    height: '28px',
                    background: '#FF3131',
                    border: '2px solid white',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    fontSize: '14px'
                  }}>
                    🚽
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: '-6px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '0',
                    height: '0',
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: '6px solid #FF3131'
                  }}></div>
                </div>
              </div>
              <div className="flex-1">
                <div className="font-medium text-red-800 text-sm">{t('welcome.redPin')}</div>
                <div className="text-xs text-red-700 mt-1">
                  {t('welcome.redPinDescription')}
                </div>
              </div>
            </div>

 {/* Blue pin explanation */}
 <div className="flex items-center space-x-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex-shrink-0 mb-4">
                {/* Actual blue pin design from map */}
                <div style={{
                  position: 'relative',
                  width: '32px',
                  height: '40px'
                }}>
                  <div style={{
                    position: 'absolute',
                    bottom: '0',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '28px',
                    height: '28px',
                    background: '#2563EB',
                    border: '2px solid white',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    fontSize: '14px'
                  }}>
                    🚽
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: '-6px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '0',
                    height: '0',
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: '6px solid #2563EB'
                  }}></div>
                </div>
              </div>
              <div className="flex-1">
                <div className="font-medium text-blue-800 text-sm">{t('welcome.bluePin')}</div>
                <div className="text-xs text-blue-700 mt-1">
                  {t('welcome.bluePinDescription')}
                </div>
              </div>
            </div>

            {/* Green pin explanation */}
            <div className="flex items-center space-x-2 p-2 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex-shrink-0 mb-4">
                {/* Actual green pin design from map */}
                <div style={{
                  position: 'relative',
                  width: '32px',
                  height: '40px'
                }}>
                  <div style={{
                    position: 'absolute',
                    bottom: '0',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '28px',
                    height: '28px',
                    background: '#22C55E',
                    border: '2px solid white',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    fontSize: '14px'
                  }}>
                    🚽
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: '-6px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '0',
                    height: '0',
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: '6px solid #22C55E'
                  }}></div>
                </div>
              </div>
              <div className="flex-1">
                <div className="font-medium text-green-800 text-sm">{t('welcome.greenPin')}</div>
                <div className="text-xs text-green-700 mt-1">
                  {t('welcome.greenPinDescription')}
                </div>
              </div>
            </div>

            {/* Pink pin explanation */}
            <div className="flex items-center space-x-2 p-2 bg-pink-50 border border-pink-200 rounded-lg">
              <div className="flex-shrink-0 mb-4">
                {/* Actual pink pin design from map */}
                <div style={{
                  position: 'relative',
                  width: '32px',
                  height: '40px'
                }}>
                  <div style={{
                    position: 'absolute',
                    bottom: '0',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '28px',
                    height: '28px',
                    background: '#f472b6',
                    border: '2px solid white',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    fontSize: '14px'
                  }}>
                    👶
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: '-6px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '0',
                    height: '0',
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: '6px solid #f472b6'
                  }}></div>
                </div>
              </div>
              <div className="flex-1">
                <div className="font-medium text-pink-800 text-sm">{t('welcome.pinkPin')}</div>
                <div className="text-xs text-pink-700 mt-1">
                  {t('welcome.pinkPinDescription')}
                </div>
              </div>
            </div>
          </div>

          {/* User contribution section */}
          {/*
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <h3 className="font-semibold text-green-800 text-sm mb-2.5">{t('welcome.howToHelp')}</h3>
                <div className="space-y-2.5">
                  <div className="flex items-start space-x-2">
                    <Flag className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-green-700">
                      <span className="font-medium">{t('welcome.reportIncorrect')}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    <Plus className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-green-700">
                      <span className="font-medium">{t('welcome.addNew')}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    <Star className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-green-700">
                      <span className="font-medium">{t('welcome.leaveReviews')}</span>
                    </div>
                  </div>
                </div>
              </div>
          */}

          {/* Close button */}
          <div className="pt-1">
            <Button
              onClick={onClose}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 text-sm"
            >
              {t('welcome.gotIt')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
