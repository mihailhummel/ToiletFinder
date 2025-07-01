import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { createRoot } from "react-dom/client";
import { ToiletMarker } from "./ToiletMarker";
import { useToilets } from "@/hooks/useToilets";
import type { Toilet, MapLocation } from "@/types/toilet";

interface MapProps {
  onToiletClick: (toilet: Toilet) => void;
  userLocation?: MapLocation;
  onMapClick?: (location: MapLocation) => void;
}

// Set your Mapbox token here
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";

export const Map = ({ onToiletClick, userLocation, onMapClick }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [mapCenter, setMapCenter] = useState<MapLocation>({ lat: 42.6977, lng: 23.3219 }); // Sofia, Bulgaria

  const { data: toilets = [] } = useToilets(userLocation);

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [mapCenter.lng, mapCenter.lat],
      zoom: 12,
      attributionControl: false
    });

    // Add user location if available
    if (userLocation) {
      new mapboxgl.Marker({ color: '#1976D2' })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map.current);
    }

    // Handle map clicks
    map.current.on('click', (e) => {
      if (onMapClick) {
        onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
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
      map.current?.remove();
    };
  }, []);

  // Update map center when user location changes
  useEffect(() => {
    if (userLocation && map.current) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 15
      });
    }
  }, [userLocation]);

  // Update toilet markers
  useEffect(() => {
    if (!map.current) return;

    // Remove existing markers
    markers.current.forEach(marker => marker.remove());
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

      const marker = new mapboxgl.Marker({ element: markerElement })
        .setLngLat([toilet.coordinates.lng, toilet.coordinates.lat])
        .addTo(map.current!);

      markers.current.push(marker);
    });
  }, [toilets, onToiletClick]);

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-full bg-gray-100"
      style={{ minHeight: '400px' }}
    />
  );
};
