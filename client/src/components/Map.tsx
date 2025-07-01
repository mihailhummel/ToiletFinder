import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ToiletMarker } from "./ToiletMarker";
import { useToilets } from "@/hooks/useToilets";
import type { Toilet, MapLocation } from "@/types/toilet";

interface MapProps {
  onToiletClick: (toilet: Toilet) => void;
  userLocation?: MapLocation;
  onMapClick?: (location: MapLocation) => void;
}

// Declare Leaflet types for global window object
declare global {
  interface Window {
    L: any;
  }
}

export const Map = ({ onToiletClick, userLocation, onMapClick }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [mapCenter, setMapCenter] = useState<MapLocation>({ lat: 42.6977, lng: 23.3219 }); // Sofia, Bulgaria
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  const { data: toilets = [] } = useToilets(userLocation);

  // Load Leaflet CSS and JS
  useEffect(() => {
    // Add Leaflet CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    cssLink.crossOrigin = '';
    document.head.appendChild(cssLink);

    // Add Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(cssLink);
      document.head.removeChild(script);
    };
  }, []);

  // Initialize map when Leaflet is loaded
  useEffect(() => {
    if (!leafletLoaded || !mapContainer.current || map.current) return;

    const L = window.L;
    
    map.current = L.map(mapContainer.current).setView([mapCenter.lat, mapCenter.lng], 12);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map.current);

    // Add user location marker if available
    if (userLocation) {
      L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
          className: 'user-location-marker',
          html: '<div style="background: #1976D2; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }).addTo(map.current);
    }

    // Handle map clicks
    map.current.on('click', (e: any) => {
      if (onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    // Update map center when map moves
    map.current.on('moveend', () => {
      if (map.current) {
        const center = map.current.getCenter();
        setMapCenter({ lat: center.lat, lng: center.lng });
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [leafletLoaded, mapCenter.lat, mapCenter.lng]);

  // Update map center when user location changes
  useEffect(() => {
    if (userLocation && map.current && leafletLoaded) {
      map.current.setView([userLocation.lat, userLocation.lng], 15);
    }
  }, [userLocation, leafletLoaded]);

  // Update toilet markers
  useEffect(() => {
    if (!map.current || !leafletLoaded) return;

    const L = window.L;

    // Remove existing markers
    markers.current.forEach(marker => map.current.removeLayer(marker));
    markers.current = [];

    // Add new markers
    toilets.forEach(toilet => {
      const markerElement = document.createElement('div');
      const root = createRoot(markerElement);
      
      root.render(
        <ToiletMarker
          type={toilet.type}
          onClick={() => onToiletClick(toilet)}
        />
      );

      const marker = L.marker([toilet.coordinates.lat, toilet.coordinates.lng], {
        icon: L.divIcon({
          className: 'custom-toilet-marker',
          html: markerElement.innerHTML,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      });

      marker.on('click', () => onToiletClick(toilet));
      marker.addTo(map.current);
      markers.current.push(marker);
    });
  }, [toilets, onToiletClick, leafletLoaded]);

  if (!leafletLoaded) {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <div className="text-gray-600">Loading map...</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-full bg-gray-100"
      style={{ minHeight: '400px' }}
    />
  );
};
