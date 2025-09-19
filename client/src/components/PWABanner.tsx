import { useState, useEffect } from "react";
import { Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PWABanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Show banner after 3 seconds if not dismissed
      setTimeout(() => {
        const dismissed = localStorage.getItem('pwa-banner-dismissed');
        if (!dismissed) {
          setShowBanner(true);
        }
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 bg-primary text-white p-3 z-30 transform transition-transform duration-300 ${showBanner ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="flex items-center justify-between max-w-md mx-auto">
        <div className="flex items-center space-x-2">
          <Smartphone className="w-4 h-4" />
          <span className="text-sm">Add to home screen for quick access</span>
        </div>
        <div className="space-x-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleInstall}
            className="bg-white text-primary hover:bg-gray-100"
          >
            Install
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="text-white hover:bg-white/10 p-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
