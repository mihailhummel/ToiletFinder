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

// Declare Mapbox GL types for global window object
declare global {
  interface Window {
    mapboxgl: any;
  }
}

export const Map = ({ onToiletClick, onAddToiletClick }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [mapboxLoaded, setMapboxLoaded] = useState(false);
  const [isAwayFromUser, setIsAwayFromUser] = useState(false);
  
  const { location: userLocation, loading: locationLoading } = useGeolocation();
  const { user } = useAuth();
  
  // Use nearby toilets within 100m when user location is available
  const { data: toilets = [] } = useToilets(userLocation);

  // Load Mapbox GL CSS and JS
  useEffect(() => {
    // Add Mapbox CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
    document.head.appendChild(cssLink);

    // Add Mapbox JS
    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
    script.onload = () => {
      setMapboxLoaded(true);
    };
    document.head.appendChild(script);

    return () => {
      if (cssLink.parentNode) document.head.removeChild(cssLink);
      if (script.parentNode) document.head.removeChild(script);
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapboxLoaded || !mapContainer.current || map.current) return;

    // Use a default center (Sofia) until user location is available
    const initialCenter = userLocation || { lat: 42.6977, lng: 23.3219 };

    // Use OpenStreetMap style without requiring API key
    map.current = new window.mapboxgl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{
          id: 'osm',
          type: 'raster',
          source: 'osm'
        }]
      },
      center: [initialCenter.lng, initialCenter.lat],
      zoom: userLocation ? 16 : 13,
      pitch: 0,
      bearing: 0
    });

    // Add navigation controls
    map.current.addControl(new window.mapboxgl.NavigationControl(), 'top-right');

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

    // Add click handler for adding toilets
    map.current.on('click', (e: any) => {
      if (user) { // Only allow if authenticated
        const { lng, lat } = e.lngLat;
        onAddToiletClick({ lat, lng });
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxLoaded, userLocation, user, onAddToiletClick]);

  // Update user location and center map
  useEffect(() => {
    if (!map.current || !userLocation) return;

    // Remove existing user marker
    if (map.current.userMarker) {
      map.current.userMarker.remove();
    }

    // Add user location marker
    const userEl = document.createElement('div');
    userEl.className = 'user-location-marker';
    userEl.style.cssText = `
      width: 20px;
      height: 20px;
      border: 3px solid #3b82f6;
      background: white;
      border-radius: 50%;
      box-shadow: 0 0 0 rgba(59, 130, 246, 0.4);
      animation: pulse 2s infinite;
    `;

    map.current.userMarker = new window.mapboxgl.Marker(userEl)
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map.current);

    // Center map on user location with high zoom
    map.current.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: 16,
      duration: 1000
    });

    // Add pulsing animation CSS if not already added
    if (!document.getElementById('user-marker-animation')) {
      const style = document.createElement('style');
      style.id = 'user-marker-animation';
      style.textContent = `
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
      `;
      document.head.appendChild(style);
    }
  }, [userLocation]);

  // Add toilet markers
  useEffect(() => {
    if (!map.current || !mapboxLoaded) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add toilet markers
    toilets.forEach((toilet) => {
      const el = document.createElement('div');
      el.className = 'toilet-marker';
      el.style.cssText = `
        width: 30px;
        height: 40px;
        background-color: #dc2626;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg) translate(-50%, -50%);
        cursor: pointer;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        font-weight: bold;
      `;
      
      // Add toilet icon
      const icon = document.createElement('div');
      icon.textContent = 'T';
      icon.style.transform = 'rotate(45deg)';
      el.appendChild(icon);

      el.addEventListener('click', () => onToiletClick(toilet));

      const marker = new window.mapboxgl.Marker(el)
        .setLngLat([toilet.coordinates.lng, toilet.coordinates.lat])
        .addTo(map.current);

      markers.current.push(marker);
    });
  }, [toilets, mapboxLoaded, onToiletClick]);

  const returnToUserLocation = () => {
    if (map.current && userLocation) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 16,
        duration: 1000
      });
      setIsAwayFromUser(false);
    }
  };

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapContainer} 
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
      
      {/* Loading state */}
      {(!mapboxLoaded || locationLoading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-gray-500">
            {locationLoading ? 'Finding your location...' : 'Loading map...'}
          </div>
        </div>
      )}

      {/* Return to location button */}
      {isAwayFromUser && userLocation && (
        <Button
          onClick={returnToUserLocation}
          className="absolute top-4 left-4 bg-white text-gray-700 hover:bg-gray-50 border shadow-lg"
          size="sm"
        >
          <Crosshair className="w-4 h-4 mr-2" />
          Back to my location
        </Button>
      )}

      {/* Add toilet button (only when authenticated) */}
      {user && (
        <Button
          onClick={() => onAddToiletClick(userLocation || { lat: 42.6977, lng: 23.3219 })}
          className="absolute bottom-6 right-6 bg-red-600 hover:bg-red-700 text-white shadow-lg rounded-full w-14 h-14"
        >
          <Plus className="w-6 h-6" />
        </Button>
      )}
    </div>
  );
};

// Helper function to calculate distance between two points
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

  return R * c;
}