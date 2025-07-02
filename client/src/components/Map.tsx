import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Crosshair, Plus } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToilets } from '@/hooks/useToilets';
import { useAuth } from '@/hooks/useAuth';
import type { Toilet, MapLocation } from '@/types/toilet';

interface MapProps {
  onToiletClick: (toilet: Toilet) => void;
  onAddToiletClick: (location: MapLocation) => void;
  onLoginClick: () => void;
}

declare global {
  interface Window {
    L: any;
    getDirections: (lat: number, lng: number) => void;
    setRating: (toiletId: string, rating: number) => void;
    hoverStars: (toiletId: string, rating: number) => void;
    resetStars: (toiletId: string) => void;
    submitReview: (toiletId: string) => void;
    cancelReview: (toiletId: string) => void;
    loadReviews: (toiletId: string) => void;
    openLoginModal: () => void;
    getCurrentUser: () => any;
    currentRating?: { toiletId: string; rating: number };
  }
}

const MapComponent = ({ onToiletClick, onAddToiletClick, onLoginClick }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const userMarker = useRef<any>(null);
  const userRingMarker = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [isAwayFromUser, setIsAwayFromUser] = useState(false);
  

  
  const { location: userLocation, loading: locationLoading, getCurrentLocation } = useGeolocation();
  
  // Auto-request location on component mount
  useEffect(() => {
    getCurrentLocation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: toilets = [] } = useToilets(); // Load all toilets in Bulgaria
  const { user } = useAuth();

  // Stable references to prevent unnecessary re-renders
  const stableToilets = useMemo(() => {
    return toilets.length > 0 ? toilets : [];
  }, [toilets.length, toilets]);

  const stableUserLocation = useMemo(() => {
    return userLocation;
  }, [userLocation?.lat, userLocation?.lng]);

  // Load Leaflet CSS and JS
  useEffect(() => {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(cssLink);

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

  // Set up global functions for popup buttons
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).getDirections = (lat: number, lng: number) => {
        const userAgent = navigator.userAgent;
        const url = userAgent.includes('iPhone') || userAgent.includes('iPad')
          ? `maps://maps.google.com/maps?daddr=${lat},${lng}&amp;ll=`
          : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        window.open(url, '_blank');
      };

      (window as any).loadReviews = async (toiletId: string) => {
        try {
          const response = await fetch(`/api/toilets/${toiletId}/reviews`);
          if (response.ok) {
            const reviews = await response.json();
            const reviewsContainer = document.getElementById(`reviews-${toiletId}`);
            if (reviewsContainer) {
              if (reviews.length > 0) {
                reviewsContainer.innerHTML = `
                  <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                    <div style="font-size: 13px; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                      Recent Reviews (${reviews.length})
                    </div>
                    <div style="max-height: 200px; overflow-y: auto;">
                      ${reviews.slice(0, 5).map((review: any) => `
                        <div style="padding: 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 8px;">
                          <div style="display: flex; align-items: center; justify-between; margin-bottom: 6px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                              <div style="width: 24px; height: 24px; background: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 600;">
                                ${review.userName.charAt(0).toUpperCase()}
                              </div>
                              <span style="font-size: 14px; font-weight: 500; color: #374151;">${review.userName}</span>
                            </div>
                            <div style="display: flex; color: #facc15;">
                              ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                            </div>
                          </div>
                          ${review.text ? `<div style="font-size: 14px; color: #6b7280; line-height: 1.4;">${review.text}</div>` : ''}
                          <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">
                            ${new Date(review.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                `;
              } else {
                reviewsContainer.innerHTML = `
                  <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                    <div style="font-size: 14px; color: #9ca3af; font-style: italic; text-align: center; padding: 20px;">
                      No reviews yet. Be the first to review this toilet!
                    </div>
                  </div>
                `;
              }
            }
          }
        } catch (error) {
          console.error('Error loading reviews:', error);
        }
      };

      (window as any).openLoginModal = () => {
        onLoginClick();
      };
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapContainer.current) return;
    
    if (map.current && map.current.getContainer()) {
      return;
    }

    const initialCenter = stableUserLocation || { lat: 42.6977, lng: 23.3219 };

    map.current = window.L.map(mapContainer.current).setView(
      [initialCenter.lat, initialCenter.lng], 
      stableUserLocation ? 16 : 13
    );

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map.current);

    let updateTimeout: number;
    map.current.on('move', () => {
      if (!stableUserLocation) return;
      
      const center = map.current.getCenter();
      const distance = getDistance(
        { lat: center.lat, lng: center.lng },
        stableUserLocation
      );
      
      setIsAwayFromUser(distance > 50);
    });

    map.current.on('blur', () => {
      if (map.current) {
        setTimeout(() => {
          if (map.current) {
            map.current.invalidateSize();
          }
        }, 100);
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [leafletLoaded, stableUserLocation]);

  const userLocationSet = useRef(false);

  // Update user location and center map
  useEffect(() => {
    if (!map.current || !stableUserLocation || !leafletLoaded) {
      return;
    }

    if (userLocationSet.current && userMarker.current && userRingMarker.current) {
      const existingLatLng = userMarker.current.getLatLng();
      if (Math.abs(existingLatLng.lat - stableUserLocation.lat) < 0.0001 && 
          Math.abs(existingLatLng.lng - stableUserLocation.lng) < 0.0001) {
        return;
      }
    }

    if (userMarker.current) {
      map.current.removeLayer(userMarker.current);
    }
    if (userRingMarker.current) {
      map.current.removeLayer(userRingMarker.current);
    }

    userMarker.current = window.L.circleMarker([stableUserLocation.lat, stableUserLocation.lng], {
      radius: 10,
      fillColor: '#3b82f6',
      color: '#ffffff',
      weight: 3,
      opacity: 1,
      fillOpacity: 1,
      interactive: false,
      zIndexOffset: 1000
    }).addTo(map.current);

    const pulseIcon = window.L.divIcon({
      className: 'pulse-ring-container',
      html: '<div style="width: 36px; height: 36px; border: 2px solid #3b82f6; border-radius: 50%; animation: pulse 1.5s infinite; opacity: 0.6;"></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    userRingMarker.current = window.L.marker([stableUserLocation.lat, stableUserLocation.lng], {
      icon: pulseIcon,
      interactive: false,
      zIndexOffset: 999
    }).addTo(map.current);

    map.current.setView([stableUserLocation.lat, stableUserLocation.lng], 16);
    userLocationSet.current = true;
  }, [stableUserLocation, leafletLoaded]);

  // Update toilet markers with persistence
  useEffect(() => {
    if (!map.current || !window.L || !stableToilets.length) return;

    console.log('Toilet markers useEffect triggered, count:', stableToilets.length);

    // Check if markers are still on the map and correct count
    const markersOnMap = markers.current.filter(marker => {
      try {
        return map.current && map.current.hasLayer(marker);
      } catch (e) {
        return false;
      }
    });

    // If we have the correct markers and they're all on the map, skip
    if (markersOnMap.length === stableToilets.length && markers.current.length === stableToilets.length) {
      console.log('All markers still present on map, skipping re-render');
      return;
    }

    console.log(`Updating markers. On map: ${markersOnMap.length}, In memory: ${markers.current.length}, Expected: ${stableToilets.length}`);

    // Clear existing markers
    markers.current.forEach(marker => {
      try {
        if (map.current && map.current.hasLayer(marker)) {
          map.current.removeLayer(marker);
        }
      } catch (e) {
        // Ignore errors
      }
    });
    markers.current = [];

    // Add toilet markers
    stableToilets.forEach(toilet => {
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

      // Generate additional info sections
      const getOpeningHours = () => {
        if (toilet.tags?.opening_hours) return toilet.tags.opening_hours;
        return null;
      };

      const getFeeInfo = () => {
        if (toilet.tags?.fee === 'no') return 'Free';
        if (toilet.tags?.fee === 'yes') return 'Paid';
        if (toilet.notes?.toLowerCase().includes('fee: no')) return 'Free';
        return null;
      };

      const getAccessibilityInfo = () => {
        if (toilet.tags?.wheelchair === 'yes') return 'Wheelchair accessible';
        if (toilet.tags?.wheelchair === 'no') return 'Not wheelchair accessible';
        if (toilet.notes?.toLowerCase().includes('wheelchair accessible: no')) return 'Not wheelchair accessible';
        if (toilet.notes?.toLowerCase().includes('wheelchair accessible: yes')) return 'Wheelchair accessible';
        return null;
      };

      const getGenderInfo = () => {
        const male = toilet.tags?.male === 'yes';
        const female = toilet.tags?.female === 'yes';
        if (male && female) return 'Male & Female';
        if (male) return 'Male only';
        if (female) return 'Female only';
        return null;
      };

      const openingHours = getOpeningHours();
      const feeInfo = getFeeInfo();
      const accessibilityInfo = getAccessibilityInfo();
      const genderInfo = getGenderInfo();

      const popupContent = `
        <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 280px;">
          <div style="margin-bottom: 12px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1f2937;">
              ${toilet.notes || 'Public Toilet'}
            </h3>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <div style="display: inline-flex; align-items: center; background: #f3f4f6; padding: 4px 8px; border-radius: 12px; font-size: 12px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                ${toilet.type?.replace('_', ' ') || 'public'}
              </div>
            </div>
          </div>
          
          ${openingHours || feeInfo || accessibilityInfo || genderInfo ? `
          <div style="margin-bottom: 12px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
            ${openingHours ? `
              <div style="display: flex; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 14px; color: #6b7280; margin-right: 8px;">🕒</span>
                <span style="font-size: 13px; color: #374151;">${openingHours}</span>
              </div>
            ` : ''}
            ${feeInfo ? `
              <div style="display: flex; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 14px; color: #6b7280; margin-right: 8px;">💰</span>
                <span style="font-size: 13px; color: #374151;">${feeInfo}</span>
              </div>
            ` : ''}
            ${accessibilityInfo ? `
              <div style="display: flex; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 14px; color: #6b7280; margin-right: 8px;">♿</span>
                <span style="font-size: 13px; color: #374151;">${accessibilityInfo}</span>
              </div>
            ` : ''}
            ${genderInfo ? `
              <div style="display: flex; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 14px; color: #6b7280; margin-right: 8px;">👥</span>
                <span style="font-size: 13px; color: #374151;">${genderInfo}</span>
              </div>
            ` : ''}
          </div>
          ` : ''}
          
          <div id="reviews-${toilet.id}"></div>
          <div style="padding-top: 16px;">
            <button onclick="window.getDirections(${toilet.coordinates.lat}, ${toilet.coordinates.lng})" style="
              width: 100%;
              padding: 12px 16px;
              background: linear-gradient(135deg, #FF385C 0%, #e11d48 100%);
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s ease;
            ">
              🧭 Get Directions
            </button>
          </div>
        </div>
      `;

      const marker = window.L.marker([toilet.coordinates.lat, toilet.coordinates.lng], { icon })
        .addTo(map.current)
        .bindPopup(popupContent, {
          maxWidth: 360,
          minWidth: 300,
          className: 'toilet-popup',
          closeButton: true,
          offset: [0, -40],
          autoPan: true,
          keepInView: true,
          autoPanPadding: [20, 20]
        })
        .on('click', (e: any) => {
          e.originalEvent?.stopPropagation();
          marker.openPopup();
          setTimeout(() => {
            (window as any).loadReviews(toilet.id);
          }, 100);
        });

      markers.current.push(marker);
    });

    console.log(`Added ${stableToilets.length} toilet markers to map`);
  }, [stableToilets]);

  const handleReturnToLocation = () => {
    if (stableUserLocation && map.current) {
      map.current.setView([stableUserLocation.lat, stableUserLocation.lng], 16);
      setIsAwayFromUser(false);
    }
  };

  const handleAddToilet = () => {
    if (!user) {
      onLoginClick();
      return;
    }
    
    if (map.current) {
      const center = map.current.getCenter();
      onAddToiletClick({ lat: center.lat, lng: center.lng });
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {(!leafletLoaded || locationLoading) && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      
      <div className="fixed bottom-8 left-8 space-y-3" style={{ zIndex: 1000 }}>
        {stableUserLocation && (
          <Button
            onClick={handleReturnToLocation}
            className="w-16 h-16 bg-white text-blue-600 shadow-xl rounded-full p-0 border border-gray-200 transition-transform duration-200 hover:scale-105 active:scale-95"
            variant="ghost"
            title="Return to my location"
          >
            <Crosshair className="w-8 h-8" />
          </Button>
        )}
      </div>

      <Button
        onClick={handleAddToilet}
        className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full shadow-xl p-0 transition-all duration-200 hover:scale-105 active:scale-95 border-2 border-white"
        style={{ zIndex: 1000 }}
        disabled={!user}
        title={!user ? "Sign in to add locations" : "Add toilet location"}
      >
        <Plus className="w-8 h-8" />
      </Button>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const Map = memo(MapComponent, (prevProps, nextProps) => {
  return (
    prevProps.onToiletClick === nextProps.onToiletClick &&
    prevProps.onAddToiletClick === nextProps.onAddToiletClick &&
    prevProps.onLoginClick === nextProps.onLoginClick
  );
});

function getDistance(point1: MapLocation, point2: MapLocation): number {
  const R = 6371e3;
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