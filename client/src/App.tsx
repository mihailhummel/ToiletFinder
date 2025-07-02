import { useState, useEffect, useCallback } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
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

// Icons
import { User, MapPin, Filter, Plus, Search, Menu } from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

// Types
import type { Toilet, MapLocation } from "./types/toilet";

function App() {
  const [selectedToilet, setSelectedToilet] = useState<Toilet | null>(null);
  const [showAddToilet, setShowAddToilet] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [mapCenter, setMapCenter] = useState<MapLocation>({ lat: 42.6977, lng: 23.3219 });
  const [filters, setFilters] = useState<FilterOptions>({
    types: ["public", "restaurant", "cafe", "gas-station", "mall", "other"],
    minRating: 1
  });

  const { user, loading: authLoading } = useAuth();
  const { location: userLocation, getCurrentLocation, loading: locationLoading } = useGeolocation();
  const { toast } = useToast();

  // Get user location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  const handleUserMenuClick = () => {
    if (user) {
      // Show user menu - for now just a placeholder
      toast({
        title: "User Menu",
        description: `Signed in as ${user.displayName || user.email}`
      });
    } else {
      setShowLogin(true);
    }
  };

  const handleLocateUser = () => {
    getCurrentLocation();
    if (userLocation) {
      toast({
        title: "Location found",
        description: "Centered map on your location"
      });
    }
  };

  const handleAddToilet = () => {
    if (!user) {
      setShowLogin(true);
      return;
    }
    setShowAddToilet(true);
  };

  const handleMapClick = useCallback((location: MapLocation) => {
    setMapCenter(location);
  }, []);

  const handleLoginClick = useCallback(() => {
    setShowLogin(true);
  }, []);

  const handleToiletClick = useCallback((toilet: Toilet) => {
    setSelectedToilet(toilet);
  }, []);

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
    <QueryClientProvider client={queryClient}>
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
                  className="w-8 h-8 rounded-full bg-gray-200 p-0"
                >
                  <User className="w-4 h-4 text-gray-600" />
                </Button>
              </div>
            </div>


          </header>

          {/* Map Container */}
          <main className="flex-1 pt-20 relative overflow-hidden">
            <Map
              onToiletClick={handleToiletClick}
              onAddToiletClick={handleAddToilet}
              onLoginClick={handleLoginClick}
            />
            

          </main>

          {/* Modals */}
          <FilterPanel
            isOpen={showFilter}
            onClose={() => setShowFilter(false)}
            onFiltersChange={setFilters}
          />

          <AddToiletModal
            isOpen={showAddToilet}
            onClose={() => setShowAddToilet(false)}
            location={mapCenter}
          />



          <LoginModal
            isOpen={showLogin}
            onClose={() => setShowLogin(false)}
          />
        </div>

        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
