import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";

// Components
import { PWABanner } from "./components/PWABanner";
import { Map } from "./components/Map";
import { FilterPanel, type FilterOptions } from "./components/FilterPanel";
import { AddToiletModal } from "./components/AddToiletModal";
import { LoginModal } from "./components/LoginModal";
import { LanguageSwitch } from "./components/LanguageSwitch";
import ErrorBoundary, { MapErrorBoundary } from "./components/ErrorBoundary";

// Utils
import { initAccessibility } from "./utils/accessibility";
// Performance monitoring removed for build simplicity

// Hooks
import { useAuth } from "./hooks/useAuth";
import { useGeolocation } from "./hooks/useGeolocation";
import { useToast } from "./hooks/use-toast";
import { clearToiletCache } from "@/hooks/useToilets";

// Icons
import { User, MapPin, Filter, Plus, Search, Menu, LogOut, Download } from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./components/ui/dialog";

// Types
import type { Toilet, MapLocation, ToiletType, Accessibility, AccessType } from "./types/toilet";
import { haptics } from "@/lib/haptics";

// Global state as backup to React state
let globalAddingState = {
  isAdding: false,
  pendingData: null as {type: ToiletType; title: string; accessibility: Accessibility; accessType: AccessType} | null
};

// Enhanced QueryClient with better garbage collection
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (was cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on quota errors
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = String(error.message);
          if (errorMessage.includes('quota') || errorMessage.includes('503')) {
            return false;
          }
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // Reduce unnecessary requests
    },
    mutations: {
      retry: 1,
    },
  },
});

function AppContent() {
  const { t } = useLanguage();
  // 🚀 Initialize accessibility
  useEffect(() => {
    initAccessibility();
    
    // Register service worker for offline support
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('🚀 Service Worker registered'))
        .catch(err => console.error('❌ Service Worker registration failed:', err));
    }

    // PWA Install detection
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const [selectedToilet, setSelectedToilet] = useState<Toilet | null>(null);
  const [showAddToilet, setShowAddToilet] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isAddingToilet, setIsAddingToilet] = useState(false); // Track if user is in add toilet mode
  const [pendingToiletLocation, setPendingToiletLocation] = useState<MapLocation | undefined>(undefined);
  const [pendingToiletData, setPendingToiletData] = useState<{type: ToiletType; title: string; accessibility: Accessibility; accessType: AccessType} | null>(null);
  const [isTransitioningToLocationMode, setIsTransitioningToLocationMode] = useState(false);
  const [mapCenter, setMapCenter] = useState<MapLocation>({ lat: 42.6977, lng: 23.3219 });
  const [filters, setFilters] = useState<FilterOptions>({
    types: ["public", "restaurant", "cafe", "gas-station", "mall", "other"],
    minRating: 1
  });

  const { user, loading: authLoading, isAdmin, signInWithGoogle, signOut } = useAuth();
  const { location: userLocation, getCurrentLocation, loading: locationLoading } = useGeolocation();
  const { toast } = useToast();

  // PWA Install functionality
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Debug state changes
  useEffect(() => {
    // Adding toilet state changed
  }, [isAddingToilet]);
  
  useEffect(() => {
    // Pending toilet data updated
  }, [pendingToiletData]);

  // Add/remove modal-open class to body when modals are open
  useEffect(() => {
    const isAnyModalOpen = showAddToilet || showFilter || showLogin || showUserMenu;
    if (isAnyModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showAddToilet, showFilter, showLogin, showUserMenu]);

  // Get user location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  // Cache management for development
  useEffect(() => {
    // Add keyboard shortcut to clear cache (Ctrl+Shift+C)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        event.preventDefault();
        clearToiletCache();
        queryClient.clear();
        toast({
                  title: t('toast.cacheCleared'),
        description: t('toast.cacheClearedMessage'),
          duration: 3000,
        });
        // Cache cleared via keyboard shortcut
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toast]);

  const handleUserMenuClick = useCallback(() => {
    if (user) {
      setShowUserMenu(true);
    } else {
      setShowLogin(true);
    }
  }, [user]);

  const handleLocateUser = () => {
    getCurrentLocation();
    if (userLocation) {
      toast({
        title: t('toast.locationFound'),
        description: t('toast.locationFoundMessage')
      });
    }
  };

  const handleAddToilet = useCallback(() => {
    haptics.light();
    if (!user) {
      setShowLogin(true);
      return;
    }
    // Step 1: Show the form first
    setIsAddingToilet(false);
    setPendingToiletLocation(undefined);
    setShowAddToilet(true);
  }, [user]);

  const handleMapClick = useCallback((location: MapLocation) => {
    // Map click processed
    
    // Check both React state and global state
    const shouldProcessClick = (isAddingToilet && pendingToiletData) || (globalAddingState.isAdding && globalAddingState.pendingData);
    
    if (shouldProcessClick) {
      // Processing toilet addition
      const dataToUse = pendingToiletData || globalAddingState.pendingData;
      
      // Clear global state
      globalAddingState.isAdding = false;
      globalAddingState.pendingData = null;
      
      // Set location and show confirmation modal
      setPendingToiletLocation(location);
      setPendingToiletData(dataToUse);
      setIsAddingToilet(false);
      setShowAddToilet(true);
    } else {
      // Map click ignored - not in adding mode
    }
  }, [isAddingToilet, pendingToiletData]);

  const handleLocationSelectionRequest = useCallback((type: ToiletType, title: string, accessibility: Accessibility, accessType: AccessType) => {
    // Location selection requested
    
    // Set global state immediately
    globalAddingState.isAdding = true;
    globalAddingState.pendingData = { type, title, accessibility, accessType };
    
    // Set React states
    setIsTransitioningToLocationMode(true);
    setPendingToiletData({ type, title, accessibility, accessType });
    setIsAddingToilet(true);
    setPendingToiletLocation(undefined);
    setShowAddToilet(false);
    
    setTimeout(() => {
      setIsTransitioningToLocationMode(false);
      // Transition to location selection complete
    }, 100);
    
    toast({
      title: "Select Location", 
      description: "Tap on the map where you want to add the toilet"
    });
  }, [toast]);

  const handleLoginClick = useCallback(() => {
    setShowLogin(true);
  }, []);

  const handleToiletClick = useCallback((toilet: Toilet) => {
    setSelectedToilet(toilet);
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      setShowUserMenu(false);
      // Delay the toast to prevent it from affecting the Map re-render
      setTimeout(() => {
        toast({
          title: "Signed out",
          description: "You have been signed out successfully"
        });
      }, 100);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive"
      });
    }
  }, [signOut, toast]);

  // PWA Install function
  const handleInstallApp = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast({
          title: t('pwa.install'),
          description: t('pwa.installDescription')
        });
      }
      
      setDeferredPrompt(null);
      setCanInstall(false);
    } else {
      // Fallback for browsers that don't support beforeinstallprompt
      toast({
        title: t('pwa.downloadApp'),
        description: t('pwa.installDescription')
      });
    }
  }, [deferredPrompt, toast, t]);





  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <QueryClientProvider client={queryClient}>
        <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
          {/* PWA Banner */}
          <PWABanner />

          {/* Header */}
          <header className="app-header fixed top-0 left-0 right-0 bg-white shadow-lg z-40 border-b">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden">
                  <img 
                    src="/logo.png" 
                    alt="Toilet Map Bulgaria Logo" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">{t('header.title')}</h1>
                  <p className="text-xs text-gray-600">Bulgaria</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Language Switch */}
                <LanguageSwitch />
                
                {/* Location Status - Hidden on mobile to save space */}
                <div className="hidden md:flex items-center space-x-2">
                  {userLocation ? (
                    <div className="flex items-center space-x-1 text-xs text-green-600">
                      <MapPin className="w-4 h-4 text-green-500" />
                      <span>{t('header.located')}</span>
                    </div>
                  ) : locationLoading ? (
                    <div className="flex items-center space-x-1 text-xs text-blue-600">
                      <div className="w-4 h-4 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>{t('header.finding')}</span>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={getCurrentLocation}
                      className="text-xs text-gray-600 hover:text-blue-600 h-6 px-2"
                    >
                      <MapPin className="w-4 h-4 mr-1" />
                      <span>{t('header.findLocation')}</span>
                    </Button>
                  )}
                </div>
                
                {/* User Menu */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUserMenuClick}
                  className="w-8 h-8 rounded-full bg-gray-200 p-0 overflow-hidden"
                >
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-4 h-4 text-gray-600" />
                  )}
                </Button>
              </div>
            </div>
          </header>

          {/* Map Container */}
          <main className="flex-1 pt-12 md:pt-16 relative overflow-hidden">
            <MapErrorBoundary>
              <Map
                onToiletClick={handleToiletClick}
                onAddToiletClick={handleMapClick}
                onLoginClick={handleLoginClick}
                isAdmin={isAdmin}
                currentUser={user}
                isAddingToilet={isAddingToilet}
              />
            </MapErrorBoundary>
            
            {/* Floating Action Button with Attention Animation */}
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAddToilet();
              }}
              className={`rounded-full shadow-lg pointer-events-auto floating-button transition-all duration-300 ${
                isAddingToilet 
                  ? 'bg-green-600 hover:bg-green-700 slow-pulse-with-ring' 
                  : 'bg-blue-600 hover:bg-blue-700 add-toilet-attention'
              }`}
              size="icon"
              style={{ 
                position: 'fixed', 
                bottom: '36px', 
                right: '24px', 
                zIndex: 1000, 
                width: '55px', 
                height: '55px'
              }}
            >
              <Plus className={`w-6 h-6 text-white transition-transform duration-300 ${
                isAddingToilet ? 'rotate-45' : 'rotate-0'
              }`} />
            </Button>
          </main>

          {/* Modals */}
          <FilterPanel
            isOpen={showFilter}
            onClose={() => setShowFilter(false)}
            onFiltersChange={setFilters}
          />

          <AddToiletModal
            isOpen={showAddToilet}
            onClose={() => {
              // Handle modal close
              if (isTransitioningToLocationMode) {
                // Ignore close during transition
                return;
              }
              setShowAddToilet(false);
              setPendingToiletLocation(undefined);
              setPendingToiletData(null);
              setIsAddingToilet(false);
            }}
            location={pendingToiletLocation}
            onRequestLocationSelection={handleLocationSelectionRequest}
            onToiletAdded={(toilet) => {
              // Toilet added successfully
              // Gently refresh the map data without clearing all caches
              if (typeof window !== 'undefined' && window.refreshToilets) {
                window.refreshToilets();
              }
            }}
          />

          <LoginModal
            isOpen={showLogin}
            onClose={() => setShowLogin(false)}
          />

          {/* User Menu Modal */}
          <Dialog open={showUserMenu} onOpenChange={setShowUserMenu}>
            <DialogContent 
              className="sm:max-w-md z-[60000] bg-white shadow-xl border-0"
              style={{
                borderRadius: '24px',
                margin: '0',
                maxWidth: '500px',
                width: 'calc(100vw - 40px)',
                maxHeight: 'calc(100vh - 112px)',
                left: '50%',
                top: 'calc(50% + 40px)',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                overflowY: 'auto',
                padding: '1rem'
              }}
            >
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-gray-900">{t('user.menu')}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col space-y-6">
                <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-700 shadow-md">
                    {user?.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-7 h-7 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {user?.displayName || 'User'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {user?.email}
                    </p>
                    {isAdmin && (
                      <p className="text-xs text-blue-600 font-medium mt-1">
                        Admin
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Action buttons */}
                <div className="flex flex-col space-y-3">
                  {/* Download App button - only show on mobile */}
                  {isMobile && (canInstall || true) && (
                    <Button
                      variant="default"
                      onClick={handleInstallApp}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {t('pwa.downloadApp')}
                    </Button>
                  )}
                  
                  {/* Sign Out button */}
                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 h-12"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {t('user.signOut')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Development Tools - only show in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="fixed top-20 right-4 bg-black bg-opacity-75 text-white p-2 rounded text-xs z-50">
              <div>Ctrl+Shift+C: Clear cache</div>
              <div>User: {user ? user.email : 'Not logged in'}</div>
              <div>Location: {userLocation ? `${userLocation.lat.toFixed(3)}, ${userLocation.lng.toFixed(3)}` : 'Unknown'}</div>
              <div>Adding: {isAddingToilet ? 'Yes' : 'No'}</div>
            </div>
          )}

          <Toaster />
        </div>
      </QueryClientProvider>
    </TooltipProvider>
  );
}

// Main App component with Language Provider
function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
