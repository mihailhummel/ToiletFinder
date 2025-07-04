import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Crosshair, Plus } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToilets, useDeleteToilet } from '@/hooks/useToilets';
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
  }
}

const MapComponent = ({ onToiletClick, onAddToiletClick, onLoginClick, isAdmin, currentUser, isAddingToilet }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const userMarker = useRef<any>(null);
  const userRingMarker = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [isAwayFromUser, setIsAwayFromUser] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<any>(null);
  const [markerClusterLoaded, setMarkerClusterLoaded] = useState(false);
  const [markerClusterError, setMarkerClusterError] = useState<string | null>(null);
  

  
  const { location: userLocation, loading: locationLoading, getCurrentLocation } = useGeolocation();
  
  // Auto-request location on component mount
  useEffect(() => {
    getCurrentLocation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toiletsQuery = useToilets();
  const toilets = toiletsQuery.data || [];
  const { user } = useAuth();
  const deleteToiletMutation = useDeleteToilet();

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
      // Dynamically load markercluster after Leaflet is loaded
      import('leaflet.markercluster/dist/leaflet.markercluster.js')
        .then(() => {
          import('leaflet.markercluster/dist/MarkerCluster.Default.css');
          setMarkerClusterLoaded(true);
        })
        .catch((err) => {
          setMarkerClusterError('Could not load marker clustering.');
          setMarkerClusterLoaded(false);
        });
    };
    document.head.appendChild(script);

    return () => {
      if (cssLink.parentNode) document.head.removeChild(cssLink);
      if (script.parentNode) document.head.removeChild(script);
    };
  }, []);

  // Set up global functions for popup buttons (always, not just in useEffect)
    if (typeof window !== 'undefined') {
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
            
            // Update review summary in header
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
        
        // Update star display
        for (let i = 1; i <= 5; i++) {
          const star = document.getElementById(`star-${toiletId}-${i}`);
          if (star) {
            star.innerHTML = i <= rating ? '★' : '☆';
            star.style.color = i <= rating ? '#facc15' : '#D1D5DB';
          }
        }
        
        // Hide tap message and show review input
        const tapMessage = document.getElementById(`tap-message-${toiletId}`);
        const reviewInput = document.getElementById(`review-input-${toiletId}`);
        
        if (tapMessage) {
          tapMessage.style.display = 'none';
        }
        
        if (reviewInput) {
          reviewInput.style.display = 'block';
        }
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
      const currentRating = window.currentRating;
        const rating = currentRating?.toiletId === toiletId ? currentRating.rating : 0;
        
        for (let i = 1; i <= 5; i++) {
          const star = document.getElementById(`star-${toiletId}-${i}`);
          if (star) {
            star.innerHTML = i <= rating ? '★' : '☆';
            star.style.color = i <= rating ? '#facc15' : '#D1D5DB';
          }
        }
      };

    window.submitReview = async (toiletId) => {
      const currentRating = window.currentRating;
        if (!currentRating || currentRating.toiletId !== toiletId) return;
        
        if (!user) {
          onLoginClick();
          return;
        }

        // Get text review
        const reviewTextElement = document.getElementById(`review-text-${toiletId}`) as HTMLTextAreaElement;
        const reviewText = reviewTextElement ? reviewTextElement.value.trim() : '';

        try {
          const response = await fetch(`/api/toilets/${toiletId}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            toiletId,
              rating: currentRating.rating,
              text: reviewText,
              userName: user.displayName,
              userId: user.uid
            })
          });

          if (response.ok) {
          window.currentRating = undefined;
          window.loadReviews(toiletId);
            
            // Reset UI
            const tapMessage = document.getElementById(`tap-message-${toiletId}`);
            const reviewInput = document.getElementById(`review-input-${toiletId}`);
            
            if (tapMessage) {
              tapMessage.style.display = 'block';
            }
            
            if (reviewInput) {
              reviewInput.style.display = 'none';
              if (reviewTextElement) reviewTextElement.value = '';
            }
            
            for (let i = 1; i <= 5; i++) {
              const star = document.getElementById(`star-${toiletId}-${i}`);
              if (star) {
                star.innerHTML = '☆';
                star.style.color = '#D1D5DB';
              }
            }
          }
        } catch (error) {
          console.error('Error submitting review:', error);
        alert('Failed to submit review. Please try again or contact support. ' + (typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error)));
        }
      };

    window.cancelReview = (toiletId) => {
      window.currentRating = undefined;
        
        // Reset UI
        const tapMessage = document.getElementById(`tap-message-${toiletId}`);
        const reviewInput = document.getElementById(`review-input-${toiletId}`);
        const reviewTextElement = document.getElementById(`review-text-${toiletId}`) as HTMLTextAreaElement;
        
        if (tapMessage) {
          tapMessage.style.display = 'block';
        }
        
        if (reviewInput) {
          reviewInput.style.display = 'none';
          if (reviewTextElement) reviewTextElement.value = '';
        }
        
        for (let i = 1; i <= 5; i++) {
          const star = document.getElementById(`star-${toiletId}-${i}`);
          if (star) {
            star.innerHTML = '☆';
            star.style.color = '#D1D5DB';
          }
        }
      };

    window.openLoginModal = () => {
        onLoginClick();
      };

    window.reportToiletNotExists = async (toiletId) => {
        if (!user) {
          onLoginClick();
          return;
        }

        try {
          const response = await fetch(`/api/toilets/${toiletId}/report-not-exists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.uid,
              userName: user.displayName || 'Anonymous User'
            })
          });

          if (response.ok) {
            const reportBtn = document.getElementById(`report-btn-${toiletId}`);
            if (reportBtn) {
              reportBtn.innerHTML = '✅ Reported - Thank you!';
              reportBtn.style.background = '#dcfce7';
              reportBtn.style.color = '#166534';
              reportBtn.style.borderColor = '#bbf7d0';
              reportBtn.style.cursor = 'default';
              reportBtn.setAttribute('onclick', '');
            }
          }
        } catch (error) {
          console.error('Error reporting toilet:', error);
        }
      };

    window.deleteToilet = async (toiletId) => {
        if (!isAdmin) {
          console.error('Only admin can delete toilets');
          return;
        }

        if (!confirm('Are you sure you want to permanently delete this toilet? This action cannot be undone.')) {
          return;
        }

        try {
          await deleteToiletMutation.mutateAsync({ 
            toiletId, 
            adminEmail: currentUser?.email || '' 
          });
          // Close all popups after deletion
          if (map.current) {
            map.current.closePopup();
          }
        } catch (error) {
          console.error('Error deleting toilet:', error);
          alert('Failed to delete toilet. Please try again.');
        }
      };
    }

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

    // Add click handler for adding new toilets
    map.current.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      onAddToiletClick({ lat, lng });
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

    userMarker.current = L.circleMarker([stableUserLocation.lat, stableUserLocation.lng], {
      radius: 10,
      fillColor: '#3b82f6',
      color: '#ffffff',
      weight: 3,
      opacity: 1,
      fillOpacity: 1,
      interactive: false,
    }).addTo(map.current);

    const pulseIcon = L.divIcon({
      className: 'pulse-ring-container',
      html: '<div style="width: 36px; height: 36px; border: 2px solid #3b82f6; border-radius: 50%; animation: pulse 1.5s infinite; opacity: 0.6;"></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    userRingMarker.current = L.marker([stableUserLocation.lat, stableUserLocation.lng], {
      icon: pulseIcon,
      interactive: false,
    }).addTo(map.current);

    map.current.setView([stableUserLocation.lat, stableUserLocation.lng], 16);
    userLocationSet.current = true;
  }, [stableUserLocation, leafletLoaded]);

  // Update toilet markers with persistence
  useEffect(() => {
    if (!map.current || !L || !stableToilets.length) return;

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

    // Add toilet markers (filter out removed toilets)
    stableToilets.filter(toilet => !toilet.isRemoved).forEach(toilet => {
      // Determine marker color based on toilet source
      const markerColor = toilet.source === 'user' ? '#7C3AED' : '#FF385C'; // Purple for user-added, red for OSM
      
      const icon = L.divIcon({
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
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 50]
      });

      // Parse toilet information
      const getToiletTitle = (toilet: any) => {
        const tags = toilet.tags || {};
        const notes = toilet.notes || '';
        // Prefer explicit name/operator/brand for context
        if (tags.name) {
          if (toilet.type === 'gas_station') return `${tags.name} Gas Station Toilet`;
          if (toilet.type === 'mall') return `${tags.name} Mall Toilet`;
          if (toilet.type === 'restaurant') return `${tags.name} Restaurant Toilet`;
          return tags.name;
        }
        if (tags.operator) {
          if (toilet.type === 'gas_station') return `${tags.operator} Gas Station Toilet`;
          if (toilet.type === 'mall') return `${tags.operator} Mall Toilet`;
          if (toilet.type === 'restaurant') return `${tags.operator} Restaurant Toilet`;
          return tags.operator;
        }
        if (tags.brand) {
          if (toilet.type === 'gas_station') return `${tags.brand} Gas Station Toilet`;
          if (toilet.type === 'mall') return `${tags.brand} Mall Toilet`;
          if (toilet.type === 'restaurant') return `${tags.brand} Restaurant Toilet`;
          return tags.brand;
        }
        if (tags['addr:housename']) {
          return tags['addr:housename'];
        }
        if (toilet.type === 'restaurant' || tags.access === 'customers') {
          if (tags['addr:housename']) return 'Toilet at ' + tags['addr:housename'];
          return 'Restaurant Toilet';
        }
        if (toilet.type === 'gas_station') {
          return 'Gas Station Toilet';
        }
        if (toilet.type === 'mall') {
          return 'Shopping Mall Toilet';
        }
        if (tags.leisure === 'park' || notes.toLowerCase().includes('park')) {
          return 'Public Toilet in Park';
        }
        if (tags.tourism || tags.highway) {
          return 'Public Toilet';
        }
        return 'Public Toilet';
      };
      
      const getAvailabilityInfo = (toilet: any) => {
        const tags = toilet.tags || {};
        const notes = toilet.notes || '';
        
        // Check fee status
        const hasFee = tags.fee === 'yes' || notes.toLowerCase().includes('fee: yes');
        const isCustomers = tags.access === 'customers' || notes.toLowerCase().includes('access: customers');
        
        if (isCustomers) {
          return {
            text: 'For customers only',
            color: '#F59E0B',
            bgColor: '#FEF3C7'
          };
        }
        
        if (hasFee) {
          return {
            text: 'Paid public access',
            color: '#7C3AED',
            bgColor: '#EDE9FE'
          };
        }
        
        return {
          text: 'Free public access',
          color: '#10B981',
          bgColor: '#D1FAE5'
        };
      };
      
      const getAccessibilityInfo = (toilet: any) => {
        const tags = toilet.tags || {};
        const notes = toilet.notes || '';
        
        const isAccessible = tags.wheelchair === 'yes' || notes.toLowerCase().includes('wheelchair accessible: yes');
        const isNotAccessible = tags.wheelchair === 'no' || notes.toLowerCase().includes('wheelchair accessible: no');
        
        if (isAccessible) {
          return {
            text: 'Wheelchair accessible',
            color: '#3B82F6',
            bgColor: '#DBEAFE'
          };
        }
        
        if (isNotAccessible) {
          return {
            text: 'Not wheelchair accessible',
            color: '#6B7280',
            bgColor: '#F3F4F6'
          };
        }
        
        return {
          text: 'Accessibility unknown',
          color: '#6B7280',
          bgColor: '#F3F4F6'
        };
      };
      
      const toiletTitle = getToiletTitle(toilet);
      const availabilityInfo = getAvailabilityInfo(toilet);
      const accessibilityInfo = getAccessibilityInfo(toilet);

      const popupContent = `
        <div style="padding: 18px; margin: 0; max-width: 100%; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px;">
          <!-- Header -->
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <div style="width: 32px; height: 32px; background: ${markerColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
              🚽
            </div>
            <div style="flex: 1;">
              <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #222; line-height: 1.2;">
                ${toiletTitle}
              </h3>
              ${toilet.source === 'user' && toilet.addedByUserName ? `
                <div style="margin: 2px 0 0 0; font-size: 12px; color: #7C3AED; font-weight: 500;">
                  Added by ${toilet.addedByUserName}
                </div>
              ` : ''}
              <div id="review-summary-${toilet.id}" style="margin: 2px 0 0 0; font-size: 13px; color: #717171;">No reviews yet</div>
            </div>
          </div>

          <!-- Info Cards -->
          <div style="margin-bottom: 18px; display: flex; flex-direction: column; gap: 10px;">
            <!-- Availability -->
            <div style="display: flex; align-items: flex-start; gap: 7px; padding: 9px; background: ${availabilityInfo.bgColor}; border-radius: 7px; border-left: 3px solid ${availabilityInfo.color};">
              <div style="width: 15px; height: 15px; background: ${availabilityInfo.color}; border-radius: 3px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">
                <div style="width: 7px; height: 7px; background: white; border-radius: 2px;"></div>
              </div>
              <div>
                <p style="margin: 0; font-size: 11px; font-weight: 600; color: #717171; text-transform: uppercase; letter-spacing: 0.5px;">AVAILABILITY</p>
                <p style="margin: 2px 0 0 0; font-size: 13px; font-weight: 500; color: #222;">${availabilityInfo.text}</p>
              </div>
            </div>

            <!-- Accessibility -->
            <div style="display: flex; align-items: flex-start; gap: 7px; padding: 9px; background: ${accessibilityInfo.bgColor}; border-radius: 7px; border-left: 3px solid ${accessibilityInfo.color};">
              <div style="width: 15px; height: 15px; background: ${accessibilityInfo.color}; border-radius: 3px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">
                <div style="width: 7px; height: 7px; background: white; border-radius: 50%; position: relative;">
                  <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 5px; height: 1px; background: ${accessibilityInfo.color};"></div>
                </div>
              </div>
              <div>
                <p style="margin: 0; font-size: 11px; font-weight: 600; color: #717171; text-transform: uppercase; letter-spacing: 0.5px;">ACCESSIBILITY</p>
                <p style="margin: 2px 0 0 0; font-size: 13px; font-weight: 500; color: #222;">${accessibilityInfo.text}</p>
              </div>
            </div>
          </div>

          <!-- Rating Section -->
          <div style="margin-bottom: 12px;">
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #717171; text-transform: uppercase; letter-spacing: 0.5px;">RATE THIS TOILET</p>
            <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
              <div style="display: flex; gap: 8px;">
                ${[1,2,3,4,5].map(star => `
                  <button 
                    onclick="window.setRating('${toilet.id}', ${star})" 
                    onmouseover="window.hoverStars('${toilet.id}', ${star})" 
                    onmouseout="window.resetStars('${toilet.id}')"
                    style="background: none; border: none; cursor: pointer; padding: 8px; font-size: 24px; line-height: 1; color: #D1D5DB; transition: color 0.2s ease; touch-action: manipulation;"
                    id="star-${toilet.id}-${star}"
                  >
                    ★
                  </button>
                `).join('')}
              </div>
            </div>
            <div id="tap-message-${toilet.id}" style="text-align: center; margin-bottom: 10px;">
              <span style="font-size: 12px; color: #717171; font-style: italic;">Tap a star to rate</span>
            </div>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 0 0 12px 0;" />
            <div id="review-input-${toilet.id}" style="display: none;">
              <textarea 
                id="review-text-${toilet.id}"
                placeholder="Leave a text review (optional)"
                style="width: 100%; padding: 7px; border: 1px solid #E5E5E5; border-radius: 5px; font-size: 13px; font-family: inherit; resize: vertical; min-height: 40px; box-sizing: border-box; margin-bottom: 4px;"
              ></textarea>
              <div style="display: flex; gap: 4px; justify-content: flex-end;">
                <button 
                  onclick="window.cancelReview('${toilet.id}')" 
                  style="background: #f7f7f7; color: #717171; border: none; padding: 6px 10px; border-radius: 5px; font-size: 12px; font-weight: 500; cursor: pointer; touch-action: manipulation;"
                  id="cancel-btn-${toilet.id}"
                >
                  Cancel
                </button>
                <button 
                  onclick="window.submitReview('${toilet.id}')" 
                  style="background: #FF385C; color: white; border: none; padding: 6px 12px; border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer; touch-action: manipulation;"
                  id="submit-btn-${toilet.id}"
                >
                  Submit Review
                </button>
              </div>
            </div>
          </div>

          <!-- Reviews Section -->
          <div id="reviews-${toilet.id}" style="margin-bottom: 18px;">
            <p style="margin: 0; font-size: 12px; color: #717171; text-align: center; padding: 4px 0; font-style: italic;">
              No reviews yet. Be the first to review this toilet!
            </p>
          </div>

          <!-- Action Buttons Row -->
          <div style="display: flex; gap: 10px; margin-bottom: 0;">
            <button 
              onclick="window.getDirections(${toilet.coordinates.lat}, ${toilet.coordinates.lng})" 
              style="
                flex: 1;
                padding: 10px 0; 
                background: #FF385C; 
                color: white; 
                border: none; 
                border-radius: 6px; 
                font-size: 13px; 
                font-weight: 600; 
                cursor: pointer; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                gap: 4px;
                transition: background-color 0.2s ease;
              "
              onmouseover="this.style.background='#E31E52'"
              onmouseout="this.style.background='#FF385C'"
            >
              🧭 Get Directions
            </button>
          <button 
            id="report-btn-${toilet.id}"
            onclick="window.reportToiletNotExists('${toilet.id}')" 
            style="
                flex: 1;
                padding: 10px 0; 
              background: #f7f7f7; 
              color: #717171; 
              border: 1px solid #E5E5E5; 
                border-radius: 6px; 
                font-size: 13px; 
              font-weight: 500; 
              cursor: pointer; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
                gap: 3px;
              transition: all 0.2s ease;
            "
            onmouseover="this.style.background='#fee2e2'; this.style.color='#dc2626'; this.style.borderColor='#fca5a5'"
            onmouseout="this.style.background='#f7f7f7'; this.style.color='#717171'; this.style.borderColor='#E5E5E5'"
          >
              ⚠️ Report
          </button>
          ${isAdmin && currentUser?.email === 'mihail.dilyanov@gmail.com' ? `
          <button 
            onclick="window.deleteToilet('${toilet.id}')" 
            style="
                flex: 1;
                padding: 10px 0; 
              background: #dc2626; 
              color: white; 
              border: none; 
                border-radius: 6px; 
                font-size: 13px; 
              font-weight: 500; 
              cursor: pointer; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
                gap: 3px;
              transition: all 0.2s ease;
            "
            onmouseover="this.style.background='#b91c1c'"
            onmouseout="this.style.background='#dc2626'"
          >
              Admin
          </button>
          ` : ''}
          </div>
        </div>
      `;

      const marker = L.marker([toilet.coordinates.lat, toilet.coordinates.lng], { icon })
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
            window.loadReviews(toilet.id);
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

  // Update bounds and fetch toilets in view on map move/zoom
  useEffect(() => {
    if (!leafletLoaded || !map.current) return;
    const leafletMap = map.current;
    const updateBounds = () => {
      const bounds = leafletMap.getBounds();
      setMapBounds(bounds);
    };
    leafletMap.on('moveend zoomend', updateBounds);
    updateBounds();
    return () => {
      leafletMap.off('moveend zoomend', updateBounds);
    };
  }, [leafletLoaded]);

  // Filter toilets in current bounds
  const toiletsInView = useMemo(() => {
    if (!mapBounds) return stableToilets;
    return stableToilets.filter(toilet => {
      if (!toilet.coordinates) return false;
      const { lat, lng } = toilet.coordinates;
      return mapBounds && mapBounds.contains && mapBounds.contains([lat, lng]);
    });
  }, [stableToilets, mapBounds]);

  // Cluster markers
  useEffect(() => {
    if (!leafletLoaded || !markerClusterLoaded || !map.current) return;
    // Remove old markers
    markers.current.forEach(m => map.current.removeLayer(m));
    markers.current = [];
    // Create marker cluster group
    if (typeof (L as any).markerClusterGroup !== 'function') {
      setMarkerClusterError('Marker clustering plugin not loaded.');
      return;
    }
    const markerCluster = (L as any).markerClusterGroup();
    toiletsInView.forEach(toilet => {
      if (!toilet.coordinates) return;
      const marker = L.marker([toilet.coordinates.lat, toilet.coordinates.lng]);
      marker.bindPopup(`<b>${toilet.notes || 'Toilet'}</b>`);
      marker.on('click', () => onToiletClick(toilet));
      markerCluster.addLayer(marker);
    });
    map.current.addLayer(markerCluster);
    markers.current.push(markerCluster);
  }, [leafletLoaded, markerClusterLoaded, toiletsInView]);

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
        <div className="bg-red-100 text-red-800 p-4 rounded mb-4 text-center">
          {fetchError}
        </div>
      )}

      {markerClusterError && (
        <div className="bg-red-100 text-red-800 p-4 rounded mb-4 text-center">
          {markerClusterError}
        </div>
      )}

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