import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Crosshair, Plus } from "lucide-react";
import { useToilets } from "@/hooks/useToilets";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useAuth } from "@/hooks/useAuth";
import type { Toilet, MapLocation } from "@/types/toilet";

interface MapProps {
  onToiletClick: (toilet: Toilet) => void;
  onAddToiletClick: (location: MapLocation) => void;
}

// Declare Leaflet types for global window object
declare global {
  interface Window {
    L: any;
  }
}

export const Map = ({ onToiletClick, onAddToiletClick }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const userMarker = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [isAwayFromUser, setIsAwayFromUser] = useState(false);
  
  const { location: userLocation, loading: locationLoading } = useGeolocation();
  const { user } = useAuth();
  
  // Use nearby toilets within 100m when user location is available
  const { data: toilets = [] } = useToilets(userLocation);

  // Load Leaflet CSS and JS
  useEffect(() => {
    // Add Leaflet CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(cssLink);

    // Add Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.head.appendChild(script);

    return () => {
      if (cssLink.parentNode) document.head.removeChild(cssLink);
      if (script.parentNode) document.head.removeChild(script);
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapContainer.current || map.current) return;

    // Use a default center (Sofia) until user location is available
    const initialCenter = userLocation || { lat: 42.6977, lng: 23.3219 };

    // Initialize Leaflet map
    map.current = window.L.map(mapContainer.current).setView(
      [initialCenter.lat, initialCenter.lng], 
      userLocation ? 16 : 13
    );

    // Add Airbnb-style tile layer using CartoDB Positron
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map.current);

    // Track when map moves away from user location
    map.current.on('move', () => {
      if (!userLocation) return;
      
      const center = map.current.getCenter();
      const distance = getDistance(
        { lat: center.lat, lng: center.lng },
        userLocation
      );
      
      setIsAwayFromUser(distance > 50); // 50 meters threshold
    });

    // Add click handler for adding toilets (only if user is authenticated)
    map.current.on('click', (e: any) => {
      // Don't trigger if clicking on a marker
      if (e.originalEvent.target.closest('.toilet-marker')) {
        return;
      }
      
      if (user) { // Only allow if authenticated
        const { lat, lng } = e.latlng;
        onAddToiletClick({ lat, lng });
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [leafletLoaded, userLocation, user, onAddToiletClick]);

  // Update user location and center map
  useEffect(() => {
    if (!map.current || !userLocation) return;

    // Remove existing user marker
    if (userMarker.current) {
      map.current.removeLayer(userMarker.current);
    }

    // Create modern user location marker with pulsing effect
    const userIcon = window.L.divIcon({
      className: 'user-location-marker',
      html: `
        <div style="
          position: relative;
          width: 20px;
          height: 20px;
        ">
          <div style="
            position: absolute;
            width: 20px;
            height: 20px;
            background: #3b82f6;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
            animation: pulse 2s infinite;
          "></div>
        </div>
        <style>
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
            100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
          }
        </style>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    userMarker.current = window.L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
      .addTo(map.current);

    // Center map on user location with high zoom
    map.current.setView([userLocation.lat, userLocation.lng], 16);
  }, [userLocation]);

  // Update toilet markers
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markers.current.forEach(marker => {
      map.current.removeLayer(marker);
    });
    markers.current = [];

    // Add toilet markers with Airbnb-style pins
    toilets.forEach(toilet => {
      const icon = window.L.divIcon({
        className: 'toilet-marker',
        html: `
          <div style="
            position: relative;
            width: 40px;
            height: 50px;
            cursor: pointer;
          ">
            <div style="
              position: absolute;
              bottom: 0;
              left: 50%;
              transform: translateX(-50%);
              width: 36px;
              height: 36px;
              background: #FF385C;
              border: 2px solid white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              font-size: 18px;
              color: white;
              font-weight: bold;
            ">
              🚽
            </div>
            <div style="
              position: absolute;
              bottom: -8px;
              left: 50%;
              transform: translateX(-50%);
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 8px solid #FF385C;
            "></div>
          </div>
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 50]
      });

      const marker = window.L.marker([toilet.coordinates.lat, toilet.coordinates.lng], { icon })
        .addTo(map.current)
        .on('click', (e) => {
          e.originalEvent.stopPropagation();
          onToiletClick(toilet);
        });

      markers.current.push(marker);
    });
  }, [toilets, onToiletClick]);

  const handleReturnToLocation = () => {
    if (userLocation && map.current) {
      map.current.setView([userLocation.lat, userLocation.lng], 16);
      setIsAwayFromUser(false);
    }
  };

  const handleAddToilet = () => {
    if (!user) {
      // Show login prompt or trigger authentication
      return;
    }
    
    if (map.current) {
      const center = map.current.getCenter();
      onAddToiletClick({ lat: center.lat, lng: center.lng });
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Loading overlay */}
      {(!leafletLoaded || locationLoading) && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      
      {/* Map Controls */}
      <div className="absolute top-4 right-4 space-y-2 z-50">
        {/* Return to Location Button - only show when away from user */}
        {isAwayFromUser && userLocation && (
          <Button
            onClick={handleReturnToLocation}
            className="w-12 h-12 bg-white text-blue-600 hover:bg-gray-50 shadow-lg rounded-full p-0 border border-gray-200"
            variant="ghost"
          >
            <Crosshair className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Floating Add Button */}
      <Button
        onClick={handleAddToilet}
        className="fixed bottom-6 right-6 w-14 h-14 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg p-0 z-50"
        disabled={!user}
        title={!user ? "Sign in to add locations" : "Add toilet location"}
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  );
};

function getDistance(point1: MapLocation, point2: MapLocation): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = point1.lat * Math.PI/180;
  const φ2 = point2.lat * Math.PI/180;
  const Δφ = (point2.lat-point1.lat) * Math.PI/180;
  const Δλ = (point2.lng-point1.lng) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}