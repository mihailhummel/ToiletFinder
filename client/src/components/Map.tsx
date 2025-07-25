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
  const toiletMarkers = useRef<Array<{ toiletId: string; marker: any }>>([]);
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
  
  // Debug the query state
  console.log('🔍 Toilets query state:', {
    data: toiletsQuery.data,
    isLoading: toiletsQuery.isLoading,
    error: toiletsQuery.error,
    toiletsLength: toilets.length,
    boundParams,
    viewportBounds
  });

  // Debug toilet loading
  useEffect(() => {
    console.log(`🚽 Toilets loaded: ${toilets.length} toilets`);
    if (toilets.length > 0) {
      console.log('Sample toilet:', toilets[0]);
    }
  }, [toilets]);
  
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
        // Check if user is logged in
        if (!user) {
          onLoginClick();
          return;
        }
        
        window.currentRating = { toiletId, rating };
        
        // Update stars to show selected rating
        for (let i = 1; i <= 5; i++) {
          const star = document.getElementById(`star-${toiletId}-${i}`);
          if (star) {
            star.innerHTML = '★';
            star.style.color = i <= rating ? '#facc15' : '#d1d5db';
            star.style.background = i <= rating ? '#fef3c7' : '#f3f4f6';
            star.style.borderColor = i <= rating ? '#f59e0b' : '#e5e7eb';
          }
        }
        
        // Show comment section
        const commentSection = document.getElementById(`review-comment-${toiletId}`);
        if (commentSection) {
          commentSection.style.display = 'block';
        }
      };

      window.hoverStars = (toiletId, rating) => {
        // Only show hover effect on desktop (not mobile)
        if ('ontouchstart' in window) return;
        
        for (let i = 1; i <= 5; i++) {
          const star = document.getElementById(`star-${toiletId}-${i}`);
          if (star) {
            star.innerHTML = '★';
            star.style.color = i <= rating ? '#facc15' : '#d1d5db';
            star.style.background = i <= rating ? '#fef3c7' : '#f3f4f6';
            star.style.borderColor = i <= rating ? '#f59e0b' : '#e5e7eb';
          }
        }
      };

      window.resetStars = (toiletId) => {
        const currentRating = window.currentRating?.toiletId === toiletId ? window.currentRating.rating : 0;
        
        for (let i = 1; i <= 5; i++) {
          const star = document.getElementById(`star-${toiletId}-${i}`);
          if (star) {
            star.innerHTML = '★';
            star.style.color = i <= currentRating ? '#facc15' : '#d1d5db';
            star.style.background = i <= currentRating ? '#fef3c7' : '#f3f4f6';
            star.style.borderColor = i <= currentRating ? '#f59e0b' : '#e5e7eb';
          }
        }
      };

      window.submitReview = async (toiletId) => {
        if (!window.currentRating || window.currentRating.toiletId !== toiletId) return;
        if (!user) {
          onLoginClick();
          return;
        }
        
        const textarea = document.getElementById(`comment-${toiletId}`) as HTMLTextAreaElement;
        const text = textarea?.value || '';
        
        try {
          const response = await fetch(`/api/toilets/${toiletId}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              toiletId,
              rating: window.currentRating.rating,
              text: text,
              userId: user.uid,
              userName: user.displayName || user.email
            })
          });
          
          if (response.ok) {
            // Hide comment section
            const commentSection = document.getElementById(`review-comment-${toiletId}`);
            if (commentSection) {
              commentSection.style.display = 'none';
            }
            
            // Clear textarea
            if (textarea) {
              textarea.value = '';
            }
            
            // Reset stars
            window.resetStars(toiletId);
            window.currentRating = undefined;
            
            // Reload reviews
            window.loadReviews(toiletId);
            
            // Show success message
            alert('Review submitted successfully!');
          } else {
            alert('Failed to submit review. Please try again.');
          }
        } catch (error) {
          console.error('Error submitting review:', error);
          alert('Error submitting review. Please try again.');
        }
      };

      window.cancelReview = (toiletId) => {
        // Hide comment section
        const commentSection = document.getElementById(`review-comment-${toiletId}`);
        if (commentSection) {
          commentSection.style.display = 'none';
        }
        
        // Clear textarea
        const textarea = document.getElementById(`comment-${toiletId}`) as HTMLTextAreaElement;
        if (textarea) {
          textarea.value = '';
        }
        
        // Reset stars and current rating
        window.currentRating = undefined;
        window.resetStars(toiletId);
      };

      window.reportToiletNotExists = async (toiletId) => {
        if (!user) {
          onLoginClick();
          return;
        }
        
        try {
          const response = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              toiletId,
              type: 'not_exists',
              description: 'Toilet reported as non-existent',
              userId: user.uid
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            
            // Update button to show reported status
            const reportButton = document.querySelector(`button[onclick="window.reportToiletNotExists('${toiletId}')"]`) as HTMLElement;
            if (reportButton) {
              reportButton.innerHTML = '✓ Reported';
              reportButton.style.background = '#10b981';
              reportButton.style.color = 'white';
              (reportButton as any).disabled = true;
            }
            
            // Check if toilet should be removed (10+ reports)
            if (result.reportCount >= 10) {
              alert('This toilet has been reported by 10+ users and will be removed from the map.');
              
              // Remove the marker from the map
              const markers = toiletMarkers.current;
              const marker = markers.find(m => m.toiletId === toiletId);
              if (marker && marker.marker) {
                map.current?.removeLayer(marker.marker);
                toiletMarkers.current = toiletMarkers.current.filter(m => m.toiletId !== toiletId);
              }
              
              // Close popup
              const popup = document.querySelector('.leaflet-popup');
              if (popup) {
                (popup as any).remove();
              }
            } else {
              alert(`Toilet reported. ${10 - result.reportCount} more reports needed for automatic removal.`);
            }
          }
        } catch (error) {
          console.error('Error reporting toilet:', error);
          alert('Error reporting toilet. Please try again.');
        }
      };

      window.deleteToilet = async (toiletId) => {
        if (!user?.email || !isAdmin) return;
        
        if (confirm('Are you sure you want to delete this toilet?')) {
          try {
            await deleteToiletMutation.mutateAsync(toiletId);
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
    console.log('🗺️ Initial map bounds:', initialBounds);
    setMapBounds(initialBounds);
    
    // Force a bounds update after a short delay to ensure proper initialization
    setTimeout(() => {
      if (map.current) {
        const bounds = map.current.getBounds();
        console.log('🗺️ Delayed map bounds:', bounds);
        setMapBounds(bounds);
      }
    }, 100);

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
    console.log(`🔍 Toilet rendering effect triggered:`, {
      hasMap: !!map.current,
      leafletLoaded,
      toiletsLength: toilets.length,
      toilets: toilets.slice(0, 3) // Show first 3 toilets for debugging
    });
    
    if (!map.current || !leafletLoaded || !toilets.length) {
      console.log('❌ Skipping toilet rendering:', {
        noMap: !map.current,
        noLeaflet: !leafletLoaded,
        noToilets: !toilets.length
      });
      return;
    }

    console.log(`📍 Rendering ${toilets.length} toilet markers`);

    // Remove existing markers layer
    if (markersLayer.current) {
      map.current.removeLayer(markersLayer.current);
      markersLayer.current = null;
    }

    // Clear toilet markers ref
    toiletMarkers.current = [];

    // Use individual markers only (clustering disabled to prevent crashes)
    markersLayer.current = L.layerGroup();

    const filteredToilets = toilets.filter(toilet => !toilet.isRemoved);
    console.log(`🔍 Filtered toilets: ${filteredToilets.length} out of ${toilets.length} (removed ${toilets.length - filteredToilets.length})`);
    
    filteredToilets.forEach(toilet => {
      // Validate toilet coordinates
      if (!toilet.coordinates || typeof toilet.coordinates.lat !== 'number' || typeof toilet.coordinates.lng !== 'number') {
        console.error('❌ Invalid toilet coordinates:', toilet);
        return;
      }
      
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
      
      // Store marker reference for later use
      toiletMarkers.current.push({ toiletId: toilet.id, marker });
    });

    if (markersLayer.current && map.current) {
      map.current.addLayer(markersLayer.current);
      console.log(`✅ Rendered ${toilets.length} toilet markers successfully`);
    } else {
      console.error('❌ Cannot add markers layer - map or layer not available');
    }
  }, [toilets, leafletLoaded]);

  // Helper functions for marker and popup creation
  const getToiletTitle = (toilet: Toilet) => {
    const tags = toilet.tags as any || {};
    if (tags.name) return tags.name;
    if (tags.operator) return tags.operator;
    if (tags.brand) return tags.brand;
    if (toilet.type === 'restaurant') return 'Restaurant Toilet';
    if (toilet.type === 'gas-station') return 'Gas Station Toilet';
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
    
    // Determine availability and accessibility based on tags
    const getAvailability = () => {
      if (tags.fee === 'yes' || tags.charge === 'yes') return { text: 'Paid', color: '#9333ea', bg: '#f3e8ff' };
      if (tags.access === 'customers' || tags.fee === 'customers') return { text: 'Only for Customers', color: '#eab308', bg: '#fefce8' };
      return { text: 'Free to use', color: '#16a34a', bg: '#f0fdf4' };
    };
    
    const getAccessibility = () => {
      if (tags.wheelchair === 'yes') return { text: 'Wheelchair accessible', color: '#2563eb', bg: '#eff6ff' };
      if (tags.wheelchair === 'no') return { text: 'Not wheelchair accessible', color: '#dc2626', bg: '#fef2f2' };
      return { text: 'Unknown', color: '#6b7280', bg: '#f9fafb' };
    };
    
    const availability = getAvailability();
    const accessibility = getAccessibility();
    
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 320px; max-width: 400px; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);">
        <!-- 1. Title -->
        <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #1f2937; line-height: 1.3;">
          ${properTitle}
        </h3>
        
        <!-- 2. Rating and Reviews Summary -->
        <div id="review-summary-${toilet.id}" style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="color: #facc15; font-size: 18px;">★★★★★</span>
            <span style="font-size: 16px; font-weight: 600; color: #374151;">0.0</span>
          </div>
          <span style="color: #6b7280; font-size: 14px;">(0 reviews)</span>
        </div>
        
        <!-- 3. Availability and Accessibility Indicators -->
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px; font-weight: 600; color: #374151; min-width: 80px;">Availability:</span>
            <span style="background: ${availability.bg}; color: ${availability.color}; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 500;">
              ${availability.text}
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px; font-weight: 600; color: #374151; min-width: 80px;">Accessibility:</span>
            <span style="background: ${accessibility.bg}; color: ${accessibility.color}; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 500;">
              ${accessibility.text}
            </span>
          </div>
        </div>
        
        <!-- 4. Star Rating Section -->
        <div id="rating-section-${toilet.id}" style="margin-bottom: 20px;">
          <div style="text-align: center; margin-bottom: 12px;">
            <div style="font-size: 16px; color: #374151; font-weight: 600; margin-bottom: 12px;">Rate this toilet</div>
            <div id="stars-${toilet.id}" style="display: flex; justify-content: center; gap: 4px;">
              ${[1,2,3,4,5].map(i => `
                <button 
                  onclick="window.setRating('${toilet.id}', ${i})"
                  id="star-${toilet.id}-${i}"
                  style="width: 36px; height: 36px; background: #f3f4f6; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; color: #d1d5db;"
                  onmouseover="window.hoverStars('${toilet.id}', ${i})"
                  onmouseout="window.resetStars('${toilet.id}')"
                >★</button>
              `).join('')}
            </div>
          </div>
          
          <!-- Review Comment Section (Hidden by default) -->
          <div id="review-comment-${toilet.id}" style="display: none; margin-top: 16px;">
            <textarea 
              id="comment-${toilet.id}"
              placeholder="Share your experience with this toilet..."
              style="width: 100%; min-height: 80px; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; font-family: inherit; resize: vertical; box-sizing: border-box;"
            ></textarea>
            <div style="display: flex; gap: 8px; margin-top: 12px;">
              <button 
                onclick="window.submitReview('${toilet.id}')"
                style="flex: 1; padding: 10px; background: #059669; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;"
                onmouseover="this.style.background='#047857'"
                onmouseout="this.style.background='#059669'"
              >
                Submit Review
              </button>
              <button 
                onclick="window.cancelReview('${toilet.id}')"
                style="flex: 1; padding: 10px; background: #6b7280; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;"
                onmouseover="this.style.background='#4b5563'"
                onmouseout="this.style.background='#6b7280'"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
        
        <!-- 5. Separating Line -->
        <div style="border-top: 2px solid #e5e7eb; margin: 20px 0;"></div>
        
        <!-- 6. Preview of Previous Reviews -->
        <div id="reviews-${toilet.id}" style="margin-bottom: 20px;">
          <div style="text-align: center; color: #6b7280; font-size: 14px; padding: 16px 0;">
            No reviews yet. Be the first to review this toilet!
          </div>
        </div>
        
        <!-- 7. Action Buttons Row -->
        <div style="display: flex; gap: 8px;">
          <button 
            onclick="window.getDirections(${toilet.coordinates.lat}, ${toilet.coordinates.lng})"
            style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;"
            onmouseover="this.style.background='#2563eb'"
            onmouseout="this.style.background='#3b82f6'"
          >
            <span style="font-size: 16px;">🧭</span>
            Directions
          </button>
          <button 
            onclick="window.reportToiletNotExists('${toilet.id}')" 
            style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; background: #dc2626; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;"
            onmouseover="this.style.background='#b91c1c'"
            onmouseout="this.style.background='#dc2626'"
          >
            <span style="font-size: 16px;">⚠️</span>
            Report
          </button>
          ${isAdmin ? `
            <button 
              onclick="window.deleteToilet('${toilet.id}')" 
              style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; background: #991b1b; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;"
              onmouseover="this.style.background='#7f1d1d'"
              onmouseout="this.style.background='#991b1b'"
            >
              <span style="font-size: 16px;">🗑️</span>
              Delete
            </button>
          ` : ''}
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
    if (toiletsQuery.error) {
      const errMsg = (toiletsQuery.error as any)?.message || '';
      if (errMsg.includes('quota') || errMsg.includes('503')) {
        setFetchError('Service temporarily unavailable due to database limits. Please try again later.');
      } else {
        setFetchError('Could not load locations. Please try again later.');
      }
    } else {
      setFetchError(null);
    }
  }, [toiletsQuery.error]);

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