import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Crosshair, Plus } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useSupabaseToilets } from '@/hooks/useSupabaseToilets';
import { useDeleteToilet, preloadToiletsForRegion } from '@/hooks/useToilets';
import { useAuth } from '@/hooks/useAuth';
import type { Toilet, MapLocation } from '@/types/toilet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// @ts-ignore
window.L = L;

interface MapProps {
  onToiletClick: (toilet: Toilet) => void;
  onAddToiletClick: (location: MapLocation) => void;
  onLoginClick: () => void;
  isAdmin?: boolean;
  currentUser?: any;
  isAddingToilet?: boolean;
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
    reportToiletNotExists: (toiletId: string) => void;
    deleteToilet: (toiletId: string) => void;
    debugToiletCache: () => any;
    clearToiletCache: () => void;
  }
}

const MapComponent = ({ onToiletClick, onAddToiletClick, onLoginClick, isAdmin, currentUser, isAddingToilet }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const userMarker = useRef<any>(null);
  const userRingMarker = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [isAwayFromUser, setIsAwayFromUser] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<any>(null);

  
  const { location: userLocation, loading: locationLoading, getCurrentLocation } = useGeolocation();
  const { user } = useAuth();
  const deleteToiletMutation = useDeleteToilet();

  // Calculate viewport bounds for API calls
  const viewportBounds = useMemo(() => {
    if (!mapBounds) return undefined;
    
    return {
      minLat: mapBounds.getSouth(),
      maxLat: mapBounds.getNorth(),
      minLng: mapBounds.getWest(),
      maxLng: mapBounds.getEast()
    };
  }, [mapBounds]);

  // Fetch toilets in current viewport
  const boundParams = viewportBounds ? {
    north: viewportBounds.maxLat,
    south: viewportBounds.minLat,
    east: viewportBounds.maxLng,
    west: viewportBounds.minLng
  } : undefined;

  // Debug logging
  useEffect(() => {
    if (boundParams) {
      console.log('🗺️ Map bounds updated:', boundParams);
    }
  }, [boundParams?.north, boundParams?.south, boundParams?.east, boundParams?.west]);

  const toiletsQuery = useSupabaseToilets({ 
    bounds: boundParams,
    enabled: !!viewportBounds 
  });
  const toilets = toiletsQuery.data || [];

  // Debug toilet loading
  useEffect(() => {
    console.log(`🚽 Toilets loaded: ${toilets.length} toilets`);
    if (toilets.length > 0) {
      console.log('Sample toilet:', toilets[0]);
    }
  }, [toilets.length]);
  
  // Stable references to prevent unnecessary re-renders
  const stableUserLocation = useMemo(() => {
    return userLocation;
  }, [userLocation?.lat, userLocation?.lng]);

  // Auto-request location on component mount and preload nearby toilets
  useEffect(() => {
    getCurrentLocation();
  }, []);

  // Preload toilets for user's region when location is available
  useEffect(() => {
    if (stableUserLocation) {
      preloadToiletsForRegion(stableUserLocation.lat, stableUserLocation.lng, 30);
    }
  }, [stableUserLocation]);

  // Load Leaflet CSS and JS (clustering disabled)
  useEffect(() => {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(cssLink);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      setLeafletLoaded(true);
      console.log('✅ Leaflet loaded successfully');
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
      // Add cache debugging tools for development
      if (process.env.NODE_ENV === 'development') {
        window.debugToiletCache = () => {
          const cached = localStorage.getItem('toilet-cache-v2');
          if (cached) {
            const data = JSON.parse(cached);
            console.log('🔍 Cache debug info:', {
              chunks: Object.keys(data.chunks).length,
              totalToilets: Object.values(data.chunks).reduce((sum: number, chunk: any) => sum + chunk.toilets.length, 0),
              oldestChunk: Math.min(...Object.values(data.chunks).map((chunk: any) => chunk.timestamp)),
              newestChunk: Math.max(...Object.values(data.chunks).map((chunk: any) => chunk.timestamp)),
              cacheSize: (new Blob([cached]).size / 1024).toFixed(1) + 'KB'
            });
            return data;
          }
          console.log('❌ No cache found');
          return null;
        };
        
        window.clearToiletCache = () => {
          localStorage.removeItem('toilet-cache-v2');
          console.log('🗑️ Cache cleared manually');
        };
        
        console.log('🛠️ Developer cache tools available: window.debugToiletCache(), window.clearToiletCache()');
        console.log('💡 Also try Ctrl+Shift+C to clear cache');
      }
      
      // Cache clearing shortcut
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
          localStorage.removeItem('toilet-cache-v2');
          window.location.reload();
          console.log('🔄 Cache cleared and page reloaded');
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);

      window.getDirections = (lat, lng) => {
        const userAgent = navigator.userAgent;
        const url = userAgent.includes('iPhone') || userAgent.includes('iPad')
          ? `maps://maps.google.com/maps?daddr=${lat},${lng}&amp;ll=`
          : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        window.open(url, '_blank');
      };

      window.loadReviews = async (toiletId) => {
        try {
          const response = await fetch(`/api/toilets/${toiletId}/reviews`);
          if (response.ok) {
            const reviews = await response.json();
            
            const reviewSummary = document.getElementById(`review-summary-${toiletId}`);
            if (reviewSummary && reviews.length > 0) {
              const avgRating = (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1);
              reviewSummary.innerHTML = `
                <span style="display: flex; align-items: center; gap: 4px;">
                  <span style="color: #facc15; font-size: 14px;">★</span>
                  <span style="font-weight: 500;">${avgRating}</span>
                  <span>(${reviews.length} review${reviews.length === 1 ? '' : 's'})</span>
                </span>
              `;
            }
            
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
                          <div style="display: flex; align-items: center; justify-content: between; margin-bottom: 6px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                              <div style="width: 24px; height: 24px; background: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 600;">
                                ${review.userName.charAt(0).toUpperCase()}
                              </div>
                              <span style="font-size: 14px; font-weight: 500; color: #374151;">${review.userName}</span>
                            </div>
                            <div style="display: flex; color: #facc15; margin-left: auto;">
                              ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                            </div>
                          </div>
                          ${review.text ? `<div style="font-size: 14px; color: #6b7280; line-height: 1.4; margin-top: 8px;">${review.text}</div>` : ''}
                          <div style="font-size: 12px; color: #9ca3af; margin-top: 6px;">
                            ${new Date(review.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                `;
              } else {
                reviewsContainer.innerHTML = ``;
              }
            }
          }
        } catch (error) {
          console.error('Error loading reviews:', error);
        }
      };

      window.setRating = (toiletId, rating) => {
        window.currentRating = { toiletId, rating };
        
        for (let i = 1; i <= 5; i++) {
          const star = document.getElementById(`star-${toiletId}-${i}`);
          if (star) {
            star.innerHTML = i <= rating ? '★' : '☆';
            star.style.color = i <= rating ? '#facc15' : '#D1D5DB';
          }
        }
        
        const tapMessage = document.getElementById(`tap-message-${toiletId}`);
        const reviewInput = document.getElementById(`review-input-${toiletId}`);
        
        if (tapMessage) tapMessage.style.display = 'none';
        if (reviewInput) reviewInput.style.display = 'block';
      };

      window.hoverStars = (toiletId, rating) => {
        for (let i = 1; i <= 5; i++) {
          const star = document.getElementById(`star-${toiletId}-${i}`);
          if (star) {
            star.innerHTML = i <= rating ? '★' : '☆';
            star.style.color = i <= rating ? '#facc15' : '#D1D5DB';
          }
        }
      };

      window.resetStars = (toiletId) => {
        const currentRating = window.currentRating?.toiletId === toiletId ? window.currentRating.rating : 0;
        for (let i = 1; i <= 5; i++) {
          const star = document.getElementById(`star-${toiletId}-${i}`);
          if (star) {
            star.innerHTML = i <= currentRating ? '★' : '☆';
            star.style.color = i <= currentRating ? '#facc15' : '#D1D5DB';
          }
        }
      };

      // Additional popup functions...
      window.submitReview = async (toiletId) => {
        if (!window.currentRating || window.currentRating.toiletId !== toiletId) return;
        
        const textarea = document.getElementById(`review-text-${toiletId}`) as HTMLTextAreaElement;
        const text = textarea?.value || '';
        
        try {
          const response = await fetch(`/api/toilets/${toiletId}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              toiletId,
              rating: window.currentRating.rating,
              text: text
            })
          });
          
          if (response.ok) {
            window.loadReviews(toiletId);
            const reviewForm = document.getElementById(`review-form-${toiletId}`);
            if (reviewForm) reviewForm.style.display = 'none';
            window.currentRating = undefined;
          }
        } catch (error) {
          console.error('Error submitting review:', error);
        }
      };

      window.cancelReview = (toiletId) => {
        const reviewForm = document.getElementById(`review-form-${toiletId}`);
        const tapMessage = document.getElementById(`tap-message-${toiletId}`);
        
        if (reviewForm) reviewForm.style.display = 'none';
        if (tapMessage) tapMessage.style.display = 'block';
        
        window.currentRating = undefined;
        window.resetStars(toiletId);
      };

      window.reportToiletNotExists = async (toiletId) => {
        try {
          const response = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              toiletId,
              type: 'not_exists',
              description: 'Toilet reported as non-existent'
            })
          });
          
          if (response.ok) {
            const button = document.getElementById(`report-btn-${toiletId}`);
            if (button) {
              button.innerHTML = '✓ Reported';
              button.style.background = '#10b981';
              button.style.color = 'white';
              (button as any).disabled = true;
            }
          }
        } catch (error) {
          console.error('Error reporting toilet:', error);
        }
      };

      window.deleteToilet = async (toiletId) => {
        if (!user?.email || !isAdmin) return;
        
        if (confirm('Are you sure you want to delete this toilet?')) {
          try {
            await deleteToiletMutation.mutateAsync({ toiletId, adminEmail: user.email });
            const popup = document.querySelector('.leaflet-popup');
            if (popup) {
              (popup as any).remove();
            }
          } catch (error) {
            console.error('Error deleting toilet:', error);
          }
        }
      };

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [user, isAdmin, deleteToiletMutation, leafletLoaded]);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapContainer.current) return;
    
    if (map.current && map.current.getContainer()) {
      return;
    }

    const initialCenter = stableUserLocation || { lat: 42.6977, lng: 23.3219 };

    map.current = L.map(mapContainer.current).setView(
      [initialCenter.lat, initialCenter.lng], 
      stableUserLocation ? 16 : 13
    );

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map.current);

    // Track map movements for distance calculation
    map.current.on('move', () => {
      if (!stableUserLocation) return;
      
      const center = map.current.getCenter();
      const distance = getDistance(
        { lat: center.lat, lng: center.lng },
        stableUserLocation
      );
      
      setIsAwayFromUser(distance > 50);
    });

    // Handle map events for bounds tracking
    map.current.on('moveend zoomend', () => {
      const bounds = map.current.getBounds();
      setMapBounds(bounds);
    });

    // Add click handler for adding new toilets
    map.current.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      onAddToiletClick({ lat, lng });
    });

    // Initialize bounds
    const initialBounds = map.current.getBounds();
    setMapBounds(initialBounds);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [leafletLoaded, stableUserLocation]);

  const userLocationSet = useRef(false);
  const lastUserLocation = useRef<{lat: number, lng: number} | null>(null);

  // Update user location and center map
  useEffect(() => {
    if (!map.current || !stableUserLocation || !leafletLoaded) {
      return;
    }

    // Check if location actually changed to prevent duplicate markers
    if (lastUserLocation.current && 
        Math.abs(lastUserLocation.current.lat - stableUserLocation.lat) < 0.0001 && 
        Math.abs(lastUserLocation.current.lng - stableUserLocation.lng) < 0.0001) {
      return;
    }

    // Always remove existing markers first
    if (userMarker.current) {
      map.current.removeLayer(userMarker.current);
      userMarker.current = null;
    }
    if (userRingMarker.current) {
      map.current.removeLayer(userRingMarker.current);
      userRingMarker.current = null;
    }

    console.log(`📍 Setting user location: ${stableUserLocation.lat.toFixed(6)}, ${stableUserLocation.lng.toFixed(6)}`);

    // Create single combined marker with pulse animation
    const combinedIcon = L.divIcon({
      className: 'user-location-combined',
      html: `
        <div class="pulse-ring"></div>
        <div class="user-dot"></div>
      `,
      iconSize: [60, 60],
      iconAnchor: [30, 30]
    });

    userMarker.current = L.marker([stableUserLocation.lat, stableUserLocation.lng], { 
      icon: combinedIcon,
      interactive: false,
      zIndexOffset: 1000
    }).addTo(map.current);

    // Update location reference
    lastUserLocation.current = { lat: stableUserLocation.lat, lng: stableUserLocation.lng };

    // Center map on first location
    if (!userLocationSet.current) {
      map.current.setView([stableUserLocation.lat, stableUserLocation.lng], 16);
      userLocationSet.current = true;
    }
  }, [stableUserLocation, leafletLoaded]);

  // Efficient toilet marker rendering
  useEffect(() => {
    if (!map.current || !leafletLoaded || !toilets.length) return;

    console.log(`📍 Rendering ${toilets.length} toilet markers`);

    // Remove existing markers layer
    if (markersLayer.current) {
      map.current.removeLayer(markersLayer.current);
      markersLayer.current = null;
    }

    // Use individual markers only (clustering disabled to prevent crashes)
    markersLayer.current = L.layerGroup();

    toilets.filter(toilet => !toilet.isRemoved).forEach(toilet => {
      const markerColor = toilet.source === 'user' ? '#7C3AED' : '#FF385C';
      
      const icon = L.divIcon({
        className: 'toilet-marker',
        html: createToiletMarkerHTML(toilet, markerColor),
        iconSize: [40, 50],
        iconAnchor: [20, 50]
      });

      const marker = L.marker([toilet.coordinates.lat, toilet.coordinates.lng], { icon })
        .addTo(markersLayer.current)
        .bindPopup(createToiletPopupHTML(toilet), {
          maxWidth: 400,
          minWidth: 320,
          className: 'refined-toilet-popup',
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
            window.loadReviews(toilet.id);
          }, 100);
        });
    });

    if (markersLayer.current) {
      map.current.addLayer(markersLayer.current);
    }

    console.log(`✅ Rendered ${toilets.length} toilet markers successfully`);
  }, [toilets, leafletLoaded]);

  // Helper functions for marker and popup creation
  const getToiletTitle = (toilet: Toilet) => {
    const tags = toilet.tags || {};
    if (tags.name) return tags.name;
    if (tags.operator) return tags.operator;
    if (tags.brand) return tags.brand;
    if (toilet.type === 'restaurant') return 'Restaurant Toilet';
    if (toilet.type === 'gas_station') return 'Gas Station Toilet';
    if (toilet.type === 'mall') return 'Shopping Mall Toilet';
    return 'Public Toilet';
  };

  const createToiletMarkerHTML = (toilet: Toilet, markerColor: string) => {
    return `
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
          background: ${markerColor};
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
          border-top: 8px solid ${markerColor};
        "></div>
      </div>
    `;
  };

  const createToiletPopupHTML = (toilet: Toilet) => {
    const toiletTitle = getToiletTitle(toilet);
    const tags = toilet.tags as any || {};
    
    // Get proper title based on type and tags
    const getProperTitle = () => {
      if (tags.name) return tags.name;
      if (tags.operator && toilet.type === 'gas-station') return `Toilet at ${tags.operator} Gas Station`;
      if (tags.brand && toilet.type === 'gas-station') return `Toilet at ${tags.brand} Gas Station`;
      if (toilet.type === 'mall') return 'Toilet in Shopping Mall';
      if (toilet.type === 'restaurant') return 'Toilet in Restaurant';
      if (toilet.type === 'cafe') return 'Toilet in Cafe';
      if (toilet.type === 'gas-station') return 'Toilet at Gas Station';
      return 'Public Toilet';
    };
    
    const properTitle = getProperTitle();
    
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 300px; padding: 16px; background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);">
        <!-- Header Section -->
        <div style="margin-bottom: 16px; border-bottom: 1px solid #f3f4f6; padding-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #1f2937; line-height: 1.3;">
            ${properTitle}
          </h3>
          
          <!-- Rating and Reviews Summary -->
          <div id="review-summary-${toilet.id}" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: #facc15; font-size: 16px;">★★★★★</span>
              <span style="font-size: 14px; font-weight: 500; color: #374151;">0.0</span>
            </div>
            <span style="color: #6b7280; font-size: 14px;">(0 reviews)</span>
          </div>
          
          <!-- Type Badge -->
          <div style="display: inline-block; background: #eff6ff; color: #2563eb; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; text-transform: capitalize;">
            ${toilet.type.replace('-', ' ')}
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 16px;">
          <button 
            onclick="window.getDirections(${toilet.coordinates.lat}, ${toilet.coordinates.lng})"
            style="display: flex; flex-direction: column; align-items: center; padding: 12px 8px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 12px; cursor: pointer; transition: background-color 0.2s; font-weight: 500;"
            onmouseover="this.style.background='#2563eb'"
            onmouseout="this.style.background='#3b82f6'"
          >
            <span style="font-size: 16px; margin-bottom: 4px;">🧭</span>
            Directions
          </button>
          <button 
            onclick="window.setRating('${toilet.id}', 5)"
            style="display: flex; flex-direction: column; align-items: center; padding: 12px 8px; background: #059669; color: white; border: none; border-radius: 8px; font-size: 12px; cursor: pointer; transition: background-color 0.2s; font-weight: 500;"
            onmouseover="this.style.background='#047857'"
            onmouseout="this.style.background='#059669'"
          >
            <span style="font-size: 16px; margin-bottom: 4px;">⭐</span>
            Review
          </button>
          <button 
            onclick="window.reportToiletNotExists('${toilet.id}')" 
            style="display: flex; flex-direction: column; align-items: center; padding: 12px 8px; background: #dc2626; color: white; border: none; border-radius: 8px; font-size: 12px; cursor: pointer; transition: background-color 0.2s; font-weight: 500;"
            onmouseover="this.style.background='#b91c1c'"
            onmouseout="this.style.background='#dc2626'"
          >
            <span style="font-size: 16px; margin-bottom: 4px;">⚠️</span>
            Report
          </button>
        </div>

        <!-- Quick Rating Section -->
        <div style="border-top: 1px solid #f3f4f6; padding-top: 16px;">
          <div style="text-align: center; margin-bottom: 12px;">
            <div style="font-size: 14px; color: #374151; font-weight: 500; margin-bottom: 8px;">Quick Rate</div>
            <div style="display: flex; justify-content: center; gap: 8px;">
              ${[1,2,3,4,5].map(i => `
                <button 
                  onclick="window.setRating('${toilet.id}', ${i})"
                  style="width: 32px; height: 32px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                  onmouseover="this.style.background='#fbbf24'; this.style.borderColor='#f59e0b'"
                  onmouseout="this.style.background='#f3f4f6'; this.style.borderColor='#e5e7eb'"
                >⭐</button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Reviews Display Section -->
        <div id="reviews-${toilet.id}" style="margin-top: 16px;">
          <div style="text-align: center; color: #6b7280; font-size: 14px; padding: 16px 0; border-top: 1px solid #f3f4f6;">
            No reviews yet. Be the first to review this toilet!
          </div>
        </div>
      </div>
    `;
  };

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

  // Handle query errors
  useEffect(() => {
    if (toiletsQuery.isError) {
      const errMsg = (toiletsQuery.error as any)?.message || '';
      if (errMsg.includes('quota') || errMsg.includes('503')) {
        setFetchError('Service temporarily unavailable due to database limits. Please try again later.');
      } else {
        setFetchError('Could not load locations. Please try again later.');
      }
    } else {
      setFetchError(null);
    }
  }, [toiletsQuery.isError, toiletsQuery.error]);

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapContainer} 
        className="w-full h-full" 
        style={{ 
          cursor: isAddingToilet ? 'crosshair' : 'grab' 
        }}
      />
      
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

      {fetchError && (
        <div className="absolute top-4 left-4 right-4 bg-red-100 text-red-800 p-4 rounded shadow-lg z-[1000]">
          {fetchError}
        </div>
      )}

      {toiletsQuery.isLoading && (
        <div className="absolute top-4 right-4 bg-blue-100 text-blue-800 p-2 rounded shadow-lg z-[1000] text-sm">
          Loading toilets...
        </div>
      )}
      
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-4 left-4 bg-white/90 text-gray-800 p-2 rounded shadow-lg z-[1000] text-xs space-y-1">
          <div>🔧 Dev Mode</div>
          <div>Toilets: {toilets.length}</div>
          <div>Cache: {(() => {
            try {
              const cached = localStorage.getItem('toilet-cache-v2');
              return cached ? `${Object.keys(JSON.parse(cached).chunks || {}).length} chunks` : 'Empty';
            } catch {
              return 'Error';
            }
          })()}</div>
          <div className="text-xs text-gray-500">Ctrl+Shift+C: Clear cache</div>
        </div>
      )}
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const Map = memo(MapComponent);

export default Map;

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