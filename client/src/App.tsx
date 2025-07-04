import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Components
import { PWABanner } from "./components/PWABanner";
import { Map } from "./components/Map";
import { FilterPanel, type FilterOptions } from "./components/FilterPanel";
import { AddToiletModal } from "./components/AddToiletModal";

import { LoginModal } from "./components/LoginModal";

// Hooks
import { useAuth } from "./hooks/useAuth";
import { useGeolocation } from "./hooks/useGeolocation";
import { useToast } from "./hooks/use-toast";
import { signOutUser } from "./lib/firebase";

// Icons
import { User, MapPin, Filter, Plus, Search, Menu, LogOut } from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./components/ui/dialog";

// Types
import type { Toilet, MapLocation, ToiletType } from "./types/toilet";

// Global state as backup to React state
let globalAddingState = {
  isAdding: false,
  pendingData: null as {type: ToiletType; notes: string} | null
};

function App() {
  const [selectedToilet, setSelectedToilet] = useState<Toilet | null>(null);
  const [showAddToilet, setShowAddToilet] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isAddingToilet, setIsAddingToilet] = useState(false); // Track if user is in add toilet mode
  const [pendingToiletLocation, setPendingToiletLocation] = useState<MapLocation | undefined>(undefined);
  const [pendingToiletData, setPendingToiletData] = useState<{type: ToiletType; notes: string} | null>(null);
  const [isTransitioningToLocationMode, setIsTransitioningToLocationMode] = useState(false);
  const [mapCenter, setMapCenter] = useState<MapLocation>({ lat: 42.6977, lng: 23.3219 });
  const [filters, setFilters] = useState<FilterOptions>({
    types: ["public", "restaurant", "cafe", "gas-station", "mall", "other"],
    minRating: 1
  });

  const { user, loading: authLoading, isAdmin } = useAuth();
  const { location: userLocation, getCurrentLocation, loading: locationLoading } = useGeolocation();
  const { toast } = useToast();

  // Debug state changes
  useEffect(() => {
    console.log("isAddingToilet changed to:", isAddingToilet);
  }, [isAddingToilet]);
  
  useEffect(() => {
    console.log("pendingToiletData changed to:", pendingToiletData);
  }, [pendingToiletData]);

  // Get user location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

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
        title: "Location found",
        description: "Centered map on your location"
      });
    }
  };

  const handleAddToilet = useCallback(() => {
    console.log("Add toilet button clicked, user:", !!user);
    if (!user) {
      console.log("No user found, showing login modal");
      setShowLogin(true);
      return;
    }
    console.log("Starting add toilet workflow - showing form first");
    // Step 1: Show the form first
    setIsAddingToilet(false);
    setPendingToiletLocation(undefined);
    setShowAddToilet(true);
  }, [user]);

  const handleMapClick = useCallback((location: MapLocation) => {
    console.log("Map clicked, isAddingToilet:", isAddingToilet, "pendingToiletData:", pendingToiletData, "location:", location);
    console.log("Global state check:", globalAddingState);
    
    // Check both React state and global state
    const shouldProcessClick = (isAddingToilet && pendingToiletData) || (globalAddingState.isAdding && globalAddingState.pendingData);
    
    if (shouldProcessClick) {
      console.log("Processing map click for toilet addition");
      const dataToUse = pendingToiletData || globalAddingState.pendingData;
      console.log("Using data:", dataToUse);
      
      // Clear global state
      globalAddingState.isAdding = false;
      globalAddingState.pendingData = null;
      
      // Set location and show confirmation modal
      setPendingToiletLocation(location);
      setPendingToiletData(dataToUse);
      setIsAddingToilet(false);
      setShowAddToilet(true);
    } else {
      console.log("Map click ignored - not in adding mode or no pending data");
    }
  }, [isAddingToilet, pendingToiletData]);

  const handleLocationSelectionRequest = useCallback((type: ToiletType, notes: string) => {
    console.log("Location selection requested for:", { type, notes });
    
    // Set global state immediately
    globalAddingState.isAdding = true;
    globalAddingState.pendingData = { type, notes };
    console.log("Global state set:", globalAddingState);
    
    // Set React states
    setIsTransitioningToLocationMode(true);
    setPendingToiletData({ type, notes });
    setIsAddingToilet(true);
    setPendingToiletLocation(undefined);
    setShowAddToilet(false);
    
    setTimeout(() => {
      setIsTransitioningToLocationMode(false);
      console.log("Transition complete. Global state:", globalAddingState);
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
      await signOutUser();
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
  }, [toast]);

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
      <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
        {/* PWA Banner */}
        <PWABanner />

        {/* Header */}
        <header className="app-header fixed top-0 left-0 right-0 bg-white shadow-lg z-40 border-b">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-4">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold">🚽</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">ToiletMap</h1>
                <p className="text-xs text-gray-600">Bulgaria</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Location Status */}
              <div className="flex items-center space-x-2">
                {userLocation ? (
                  <div className="flex items-center space-x-1 text-xs text-green-600">
                    <MapPin className="w-3 h-3 text-green-500" />
                    <span>Located</span>
                  </div>
                ) : locationLoading ? (
                  <div className="flex items-center space-x-1 text-xs text-blue-600">
                    <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Finding...</span>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={getCurrentLocation}
                    className="text-xs text-gray-600 hover:text-blue-600 h-6 px-2"
                  >
                    <MapPin className="w-3 h-3 mr-1" />
                    Find Location
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
        <main className="flex-1 pt-20 relative overflow-hidden">
          <Map
            onToiletClick={handleToiletClick}
            onAddToiletClick={handleMapClick}
            onLoginClick={handleLoginClick}
            isAdmin={isAdmin}
            currentUser={user}
            isAddingToilet={isAddingToilet}
          />
          
          {/* Floating Action Button */}
          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("Floating button clicked!");
              handleAddToilet();
            }}
            className={`fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-lg z-[9999] pointer-events-auto ${
              isAddingToilet 
                ? 'bg-green-600 hover:bg-green-700 animate-pulse' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            size="icon"
            style={{ position: 'fixed', zIndex: 9999 }}
          >
            <Plus className="w-8 h-8 text-white" />
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
            console.log("AddToiletModal onClose called, transitioning:", isTransitioningToLocationMode);
            if (isTransitioningToLocationMode) {
              console.log("Ignoring onClose - in transition mode");
              return;
            }
            
            console.log("Processing normal user close");
            setShowAddToilet(false);
            setPendingToiletLocation(undefined);
            setPendingToiletData(null);
            setIsAddingToilet(false);
          }}
          location={pendingToiletLocation}
          onRequestLocationSelection={handleLocationSelectionRequest}
        />



        <LoginModal
          isOpen={showLogin}
          onClose={() => setShowLogin(false)}
        />

        {/* User Menu Modal */}
        <Dialog open={showUserMenu} onOpenChange={setShowUserMenu}>
          <DialogContent className="sm:max-w-md z-[60000]">
            <DialogHeader>
              <DialogTitle>User Menu</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col space-y-4">
              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-blue-600">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {user?.displayName || 'User'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {user?.email}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="w-full"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}

export default App;
