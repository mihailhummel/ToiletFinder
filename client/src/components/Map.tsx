import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Crosshair, Plus } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToiletCache } from '@/hooks/useToiletCache';
import { useDeleteToilet, useAddReview, preloadToiletsForRegion } from '@/hooks/useToilets';
import { useAuth } from '@/hooks/useAuth';
import type { Toilet, MapLocation } from '@/types/toilet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { haptics } from '@/lib/haptics';
import { LoadingScreen } from './LoadingScreen';
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
    toggleReviews: (toiletId: string) => void;
    restoreReviewState: (toiletId: string) => void;
    openLoginModal: () => void;
    getCurrentUser: () => any;
    currentRating?: { toiletId: string; rating: number };
    reportToiletNotExists: (toiletId: string) => void;
    deleteToilet: (toiletId: string) => void;
    refreshMapData: () => void;
    testAPI: () => Promise<any>;
    forceRefreshToilets: () => void;
    refreshToilets: () => void;
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
  const openPopupToiletIdRef = useRef<string | null>(null);
  const manuallyClosedPopupRef = useRef<boolean>(false);
  const isReopeningPopupRef = useRef<boolean>(false);

  // Add state for review visibility and review input state
  const [reviewVisibility, setReviewVisibility] = useState<{ [key: string]: boolean }>({});
  const [reviewInputState, setReviewInputState] = useState<{ [key: string]: { rating: number; text: string; visible: boolean } }>({});
  
  // Add state for viewport optimization
  const [viewportToilets, setViewportToilets] = useState<Toilet[]>([]);
  const [isMapMoving, setIsMapMoving] = useState(false);

  
  const { location: userLocation, loading: locationLoading, getCurrentLocation } = useGeolocation();
  const { user } = useAuth();
  const deleteToiletMutation = useDeleteToilet();
  const addReviewMutation = useAddReview();

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

  // Fetch toilets in current viewport - memoized to prevent infinite loops
  const boundParams = useMemo(() => {
    return viewportBounds ? {
      north: viewportBounds.maxLat,
      south: viewportBounds.minLat,
      east: viewportBounds.maxLng,
      west: viewportBounds.minLng
    } : undefined;
  }, [viewportBounds?.maxLat, viewportBounds?.minLat, viewportBounds?.maxLng, viewportBounds?.minLng]);

  // Map bounds updates - no logging for performance

  // NEW: Use cached toilet system with clustering
  const [mapZoom, setMapZoom] = useState(14);
  const { toilets, allToiletsCount, isLoading: toiletsLoading, error: toiletsError } = useToiletCache(boundParams, mapZoom);
  
  // Cache system status available for debugging if needed
  
  // Track map zoom level for clustering
  useEffect(() => {
    if (map.current) {
      const handleZoomEnd = () => {
        const zoom = map.current.getZoom();
        setMapZoom(zoom);
        // Zoom level updated for clustering
      };
      
      map.current.on('zoomend', handleZoomEnd);
      
      return () => {
        if (map.current) {
          map.current.off('zoomend', handleZoomEnd);
        }
      };
    }
  }, [leafletLoaded]);
  
  // Silent for performance
  
  // No query state logging for performance

  // No toilet loading logging for performance
  
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

  // Load Leaflet CSS and JS (simplified without external clustering)
  useEffect(() => {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(cssLink);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      setLeafletLoaded(true);
      // Silent for performance
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
      // No development logging for performance
      
      // No cache clearing shortcut - caching removed

      window.getDirections = (lat, lng) => {
        haptics.medium();
        // Use navigation URLs that automatically start routing
        // This will trigger the native app selection on mobile devices and start navigation
        
        // For Google Maps - use navigation mode
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
        
        // For Apple Maps (iOS) - use navigation scheme
        const appleMapsUrl = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
        
        // Detect platform and use appropriate URL
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        let url;
        if (isIOS) {
          // Try Apple Maps first, fallback to Google Maps
          url = appleMapsUrl;
        } else {
          // Use Google Maps for Android and desktop
          url = googleMapsUrl;
        }
        
        // Try to open in a new tab/window
        const newWindow = window.open(url, '_blank');
        
        // If popup is blocked, fall back to current window
        if (!newWindow) {
          window.location.href = url;
        }
      };

      window.loadReviews = async (toiletId) => {
        try {
          const response = await fetch(`/api/toilets/${toiletId}/reviews`);
          if (response.ok) {
            const reviews = await response.json();
            
            const reviewSummary = document.getElementById(`review-summary-${toiletId}`);
            if (reviewSummary && reviews.length > 0) {
              const avgRating = (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1);
              const ratingNum = parseFloat(avgRating);
              const fullStars = Math.round(ratingNum);
              const starsHTML = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);
              
              reviewSummary.innerHTML = `
                <span style="display: flex; align-items: center; gap: 4px;">
                  <span style="color: #facc15; font-size: 14px;">${starsHTML}</span>
                  <span style="font-weight: 500;">${avgRating}</span>
                  <span>(${reviews.length} review${reviews.length === 1 ? '' : 's'})</span>
                </span>
              `;
            }
            
            const reviewsSection = document.getElementById(`reviews-section-${toiletId}`);
            if (reviewsSection) {
              if (reviews.length > 0) {
                reviewsSection.innerHTML = `
                  <button 
                    onclick="window.toggleReviews('${toiletId}')"
                    style="width: 100%; padding: 6px 10px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; font-weight: 500; color: #374151; cursor: pointer; transition: background-color 0.2s; display: flex; align-items: center; justify-content: space-between;"
                    onmouseover="this.style.background='#e5e7eb'"
                    onmouseout="this.style.background='#f3f4f6'"
                  >
                    <span>Reviews (${reviews.length})</span>
                    <span style="font-size: 12px; color: #6b7280;">▼</span>
                  </button>
                  <div id="reviews-${toiletId}" style="display: none; margin-top: 12px;">
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f3f4f6;">
                      <div style="font-size: 13px; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                        Recent Reviews (${reviews.length})
                      </div>
                      <div class="reviews-scrollable" style="max-height: 120px; overflow-y: auto; padding-right: 4px;">
                        ${reviews.slice(0, 5).map((review: any) => `
                          <div style="padding: 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 8px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
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
                  </div>
                `;
              } else {
                reviewsSection.innerHTML = `
                  <div style="text-align: center; color: #6b7280; font-size: 14px; padding: 8px 0;">
                    No reviews yet. Be the first to review this toilet!
                  </div>
                `;
              }
            }
            
            // Restore state after reviews are loaded and DOM is updated
            setTimeout(() => {
              window.restoreReviewState(toiletId);
            }, 50);
          }
        } catch (error) {
          console.error('Error loading reviews:', error);
        }
      };

      window.setRating = (toiletId, rating) => {
        haptics.light();
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
        
        // Update state to show review input
        setReviewInputState(prev => ({
          ...prev,
          [toiletId]: { 
            rating, 
            text: prev[toiletId]?.text || '', 
            visible: true 
          }
        }));
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
        haptics.success();
        if (!window.currentRating || window.currentRating.toiletId !== toiletId) return;
        if (!user) {
          onLoginClick();
          return;
        }
        
        const textarea = document.getElementById(`comment-${toiletId}`) as HTMLTextAreaElement;
        const text = textarea?.value || '';
        
        try {
                const reviewData = {
        toiletId,
        review: {
          toiletId,
          rating: window.currentRating.rating,
          text: text,
          userId: user.uid,
          userName: user.displayName || user.email || ''
        }
      };
          
          // Silent for performance
          
          const result = await addReviewMutation.mutateAsync(reviewData);
          
                      // Silent for performance
          
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
          
          // Update state to hide review input
          setReviewInputState(prev => ({
            ...prev,
            [toiletId]: { rating: 0, text: '', visible: false }
          }));
          
          // Reload reviews
          window.loadReviews(toiletId);
          
          // Show success message
          alert('Review submitted successfully!');
        } catch (error) {
          console.error('📝 Client: Error submitting review:', error);
          alert('Error submitting review. Please try again.');
        }
      };

      window.cancelReview = (toiletId) => {
        haptics.light();
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
        
        // Update state to hide review input
        setReviewInputState(prev => ({
          ...prev,
          [toiletId]: { rating: 0, text: '', visible: false }
        }));
      };

      window.toggleReviews = (toiletId) => {
        haptics.light();
        setReviewVisibility(prev => ({
          ...prev,
          [toiletId]: !prev[toiletId]
        }));
      };

      window.restoreReviewState = (toiletId) => {
        // Wait a bit to ensure DOM elements are ready
        setTimeout(() => {
          // Restore review visibility state
          const isReviewsVisible = reviewVisibility[toiletId];
          if (isReviewsVisible) {
            const reviewsContainer = document.getElementById(`reviews-${toiletId}`);
            if (reviewsContainer) {
              reviewsContainer.style.display = 'block';
            }
            
            // Update toggle button arrow
            const toggleButton = document.querySelector(`button[onclick="window.toggleReviews('${toiletId}')"]`);
            if (toggleButton) {
              const arrow = toggleButton.querySelector('span:last-child');
              if (arrow) {
                arrow.textContent = '▲';
              }
            }
          }
          
          // Restore review input state
          const inputState = reviewInputState[toiletId];
          if (inputState && inputState.visible) {
            // Restore rating stars
            for (let i = 1; i <= 5; i++) {
              const star = document.getElementById(`star-${toiletId}-${i}`);
              if (star) {
                star.innerHTML = '★';
                star.style.color = i <= inputState.rating ? '#facc15' : '#d1d5db';
                star.style.background = i <= inputState.rating ? '#fef3c7' : '#f3f4f6';
                star.style.borderColor = i <= inputState.rating ? '#f59e0b' : '#e5e7eb';
              }
            }
            
            // Show comment section and restore text
            const commentSection = document.getElementById(`review-comment-${toiletId}`);
            if (commentSection) {
              commentSection.style.display = 'block';
            }
            
            const textarea = document.getElementById(`comment-${toiletId}`) as HTMLTextAreaElement;
            if (textarea && inputState.text) {
              textarea.value = inputState.text;
            }
            
            // Restore current rating
            window.currentRating = { toiletId, rating: inputState.rating };
          }
        }, 10);
      };

      // Add event listener for textarea changes to persist text
      const handleTextareaChange = (toiletId: string, text: string) => {
        setReviewInputState(prev => ({
          ...prev,
          [toiletId]: {
            ...prev[toiletId],
            text,
            visible: true
          }
        }));
      };

      // Add global function for textarea changes
      (window as any).handleTextareaChange = handleTextareaChange;

              window.reportToiletNotExists = async (toiletId) => {
          haptics.light();
          if (!user) {
            onLoginClick();
            return;
          }
          
          try {
            // Silent for performance
            
            const response = await fetch(`/api/toilets/${toiletId}/report-not-exists`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                toiletId,
                userId: user.uid
              })
            });
            
            // Silent for performance
            
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
            } else {
              const errorData = await response.json().catch(() => ({}));
              console.error('Report submission failed:', errorData);
              alert(`Failed to report toilet: ${errorData.error || 'Unknown error'}`);
            }
          } catch (error) {
            console.error('Error reporting toilet:', error);
            alert('Error reporting toilet. Please try again.');
          }
        };

      window.deleteToilet = async (toiletId) => {
        haptics.warning();
        if (!user?.email || !isAdmin) return;
        
        if (confirm('Are you sure you want to delete this toilet?')) {
          try {
            await deleteToiletMutation.mutateAsync({
              toiletId,
              adminEmail: user?.email || '',
              userId: user?.uid || ''
            });
            const popup = document.querySelector('.leaflet-popup');
            if (popup) {
              (popup as any).remove();
            }
          } catch (error) {
            console.error('Error deleting toilet:', error);
          }
        }
      };

      // Add cache clearing function for debugging
      window.clearToiletCache = () => {
        // Silent for performance
        queryClient.clear();
        window.location.reload();
      };

      return () => {
        // No cleanup needed - caching removed
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

    // Debounce function for map events
    let mapMoveTimeout: NodeJS.Timeout | undefined;
    let mapMoveStartTimeout: NodeJS.Timeout | undefined;
    
    // Handle map events for bounds tracking
    const handleMapMove = () => {
      // Set moving state immediately
      setIsMapMoving(true);
      
      // Clear existing timeouts
      clearTimeout(mapMoveTimeout);
      clearTimeout(mapMoveStartTimeout);
      
      // Debounce bounds update - balanced approach
      mapMoveTimeout = setTimeout(() => {
        const bounds = map.current.getBounds();
        setMapBounds(bounds);
        setIsMapMoving(false);
      }, 600); // 600ms debounce - balance between responsiveness and performance
      
      // Reopen popup if one was open before the view change and wasn't manually closed
      if (openPopupToiletIdRef.current && !manuallyClosedPopupRef.current && !isReopeningPopupRef.current) {
        const marker = toiletMarkers.current.find(m => m.toiletId === openPopupToiletIdRef.current)?.marker;
        if (marker) {
          // Check if marker is in viewport before reopening
          const markerLatLng = marker.getLatLng();
          const mapBounds = map.current.getBounds();
          if (mapBounds.contains(markerLatLng)) {
            isReopeningPopupRef.current = true;
            setTimeout(() => {
              marker.openPopup();
              // Reload reviews when popup reopens
              if (openPopupToiletIdRef.current) {
                setTimeout(() => {
                  window.loadReviews(openPopupToiletIdRef.current!);
                }, 200);
              }
              // Reset the flag after reopening
              setTimeout(() => {
                isReopeningPopupRef.current = false;
              }, 500);
            }, 500);
          } else {
            // Marker is not in viewport, don't reopen
            openPopupToiletIdRef.current = null;
            manuallyClosedPopupRef.current = false;
          }
        }
      }
    };

    const handleMapClick = (e: any) => {
      const { lat, lng } = e.latlng;
      onAddToiletClick({ lat, lng });
    };

    map.current.on('moveend zoomend', handleMapMove);
    map.current.on('click', handleMapClick);

    // Initialize bounds immediately
    const initialBounds = map.current.getBounds();
    setMapBounds(initialBounds);
    
    // Ensure initial fetch happens
    setTimeout(() => {
      if (map.current) {
        const bounds = map.current.getBounds();
        setMapBounds(bounds);
        // Force initial fetch
        if (false) { // Disabled manual refetch for now
          // Manual refetch not needed with caching system
        }
      }
    }, 200);

    return () => {
      // Clear any pending timeouts
      if (mapMoveTimeout) {
        clearTimeout(mapMoveTimeout);
      }
      
      if (map.current) {
        // Remove event listeners to prevent memory leaks
        map.current.off('moveend zoomend', handleMapMove);
        map.current.off('click', handleMapClick);
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

            // Silent for performance

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

    // Center map on first location and trigger toilet fetch
    if (!userLocationSet.current) {
      map.current.setView([stableUserLocation.lat, stableUserLocation.lng], 16);
      userLocationSet.current = true;
      
      // Trigger immediate refetch of toilets around user location
      setTimeout(() => {
        if (false) { // Disabled manual refetch for now
          // Manual refetch not needed with caching system
        }
      }, 200); // Small delay to ensure map bounds are updated
    }
  }, [stableUserLocation, leafletLoaded]);

  // Efficient toilet marker rendering with clustering and viewport optimization
  useEffect(() => {
    // Skip toilet re-rendering if a popup is currently open or map is moving
    if (openPopupToiletIdRef.current || isMapMoving) {
      return;
    }
    
    if (!map.current || !leafletLoaded || !toilets.length) {
      return;
    }

    // Store current open popup info before removing markers
    const currentOpenPopup = openPopupToiletIdRef.current;
    
    // Remove existing markers layer
    if (markersLayer.current) {
      map.current.removeLayer(markersLayer.current);
      markersLayer.current = null;
    }

    // Clear toilet markers ref
    toiletMarkers.current = [];

    // Use regular layer group with viewport optimization
    markersLayer.current = L.layerGroup();

    // Make sure we're not filtering out any valid toilets
    const filteredToilets = toilets.filter(toilet => {
      // Check for invalid toilets
      if (!toilet) {
        console.error('❌ Invalid toilet: null or undefined');
        return false;
      }
      
      // Fix invalid coordinates instead of filtering out
      if (!toilet.coordinates || typeof toilet.coordinates.lat !== 'number' || typeof toilet.coordinates.lng !== 'number') {
        console.warn(`⚠️ Toilet ${toilet.id} has invalid coordinates:`, toilet.coordinates);
        
        // Fix coordinates with Sofia center as fallback
        toilet.coordinates = {
          lat: 42.6977,
          lng: 23.3219
        };
        toilet.lat = toilet.coordinates.lat;
        toilet.lng = toilet.coordinates.lng;
        
        // Silent for performance
      }
      
      // Silent for performance
      
      // Only filter out removed toilets
      return !toilet.isRemoved;
    });
    
    // Silent for performance
    
    // Limit the number of markers for performance (max 1000)
    const limitedToilets = filteredToilets.slice(0, 1000);
    
    // No need for viewport filtering since we only fetch toilets in viewport
    const viewportToilets = limitedToilets;
    
    // Silent for performance
    
    viewportToilets.forEach(toilet => {
      // Validate toilet coordinates - this should never happen now that we fix them above
      if (!toilet.coordinates || typeof toilet.coordinates.lat !== 'number' || typeof toilet.coordinates.lng !== 'number') {
        // Silent for performance
        return;
      }
      
      // Set marker color: blue for user-added toilets, red for OSM and Geoapify toilets
      const markerColor = toilet.source === 'user' ? '#3B82F6' : '#FF385C'; 
      
               // Silent for performance
      
      try {
        const icon = L.divIcon({
          className: 'toilet-marker',
          html: createToiletMarkerHTML(toilet, markerColor),
          iconSize: [40, 50],
          iconAnchor: [20, 50]
        });

      const marker = L.marker([toilet.coordinates.lat, toilet.coordinates.lng], { 
          icon,
          // Optimize marker performance
          keyboard: false,
          title: toilet.isCluster ? `${toilet.clusterCount} toilets` : (toilet.title || 'Toilet')
        })
        .addTo(markersLayer.current);
        
      // Handle cluster vs regular toilet clicks
      if (toilet.isCluster) {
        // Cluster marker - zoom in when clicked
        marker.on('click', () => {
          if (map.current && toilet.clusterCenter) {
            map.current.setView([toilet.clusterCenter.lat, toilet.clusterCenter.lng], Math.min(mapZoom + 2, 18));
          }
        });
      } else {
        // Regular toilet marker - show popup
        marker.bindPopup(createToiletPopupHTML(toilet), {
          maxWidth: 400,
          minWidth: 320,
          className: 'refined-toilet-popup',
          closeButton: true,
          offset: [0, -40],
          autoPan: true,
          keepInView: true,
          autoPanPadding: [40, 40]
        });
      }
      
      marker
        .on('popupopen', () => {
          openPopupToiletIdRef.current = toilet.id;
          manuallyClosedPopupRef.current = false;
          isReopeningPopupRef.current = false;
          
          // Custom panning to ensure popup is visible without closing it
          setTimeout(() => {
            const markerLatLng = marker.getLatLng();
            const mapBounds = map.current.getBounds();
            const popup = marker.getPopup();
            
            if (popup && !mapBounds.contains(markerLatLng)) {
              // Pan to marker with padding to ensure popup is visible
              map.current.panTo(markerLatLng, { 
                animate: true,
                duration: 0.5,
                easeLinearity: 0.25
              });
            }
          }, 100);
          
          // Reviews will be loaded and state restored automatically
        })
        .on('popupclose', () => {
          openPopupToiletIdRef.current = null;
          manuallyClosedPopupRef.current = true;
          
          // Trigger toilet re-rendering after popup closes to catch up on any missed updates
          setTimeout(() => {
            if (map.current && leafletLoaded && toilets.length) {
              // Silent for performance
              // Force a re-render by updating the dependency
              setMapBounds(map.current.getBounds());
            }
          }, 500);
        })
        .on('click', (e: any) => {
          haptics.light();
          e.originalEvent?.stopPropagation();
          openPopupToiletIdRef.current = toilet.id;
          manuallyClosedPopupRef.current = false;
          isReopeningPopupRef.current = false;
          marker.openPopup();
          setTimeout(() => {
            window.loadReviews(toilet.id);
          }, 100);
        });
      
        // Store marker reference for later use
        toiletMarkers.current.push({ toiletId: toilet.id, marker });
      } catch (error) {
        console.error(`❌ Error creating marker for toilet ${toilet.id}:`, error);
      }
    });

    if (markersLayer.current && map.current) {
      map.current.addLayer(markersLayer.current);
      
      // Count how many markers of each type were actually rendered
      const renderedUserMarkers = toiletMarkers.current.filter(m => 
        toilets.find(t => t.id === m.toiletId && t.source === 'user')
      ).length;
      
      const renderedOsmMarkers = toiletMarkers.current.filter(m => 
        toilets.find(t => t.id === m.toiletId && t.source === 'osm')
      ).length;
      
      const renderedGeoapifyMarkers = toiletMarkers.current.filter(m => 
        toilets.find(t => t.id === m.toiletId && t.source === 'geoapify')
      ).length;
      
               // Silent for performance
      
      // Reopen popup if one was open before toilet re-rendering
      if (currentOpenPopup && !manuallyClosedPopupRef.current) {
        setTimeout(() => {
          const marker = toiletMarkers.current.find(m => m.toiletId === currentOpenPopup)?.marker;
          if (marker) {
            marker.openPopup();
            // Reload reviews for the reopened popup (state will be restored automatically)
            setTimeout(() => {
              window.loadReviews(currentOpenPopup);
            }, 200);
          }
        }, 100);
      }
    } else {
      console.error('❌ Cannot add markers layer - map or layer not available');
    }
  }, [toilets, leafletLoaded]);

  // Helper functions for marker and popup creation
  const createToiletMarkerHTML = (toilet: any, markerColor: string) => {
    // Handle cluster markers
    if (toilet.isCluster) {
      return `
        <div style="
          position: relative;
          width: 50px;
          height: 50px;
          cursor: pointer;
        ">
          <div style="
            position: absolute;
            bottom: 5px;
            left: 50%;
            transform: translateX(-50%);
            width: 46px;
            height: 46px;
            background: linear-gradient(135deg, #ff6b6b, #4ecdc4);
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            font-weight: bold;
            color: white;
            font-size: 14px;
          ">
            ${toilet.clusterCount}
          </div>
        </div>
      `;
    }
    
    // Regular toilet marker
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
    const tags = toilet.tags as any || {};
    
    // Get proper title based on type and custom title
    const getProperTitle = () => {
      if (toilet.title && toilet.title.trim() !== '') {
        return toilet.title;
      }
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
    
    // Determine availability and accessibility based on database fields or tags
    const getAvailability = () => {
      if (toilet.accessType === 'paid') return { text: 'Paid Access', color: '#9333ea', bg: '#f3e8ff' };
      if (toilet.accessType === 'customers-only') return { text: 'Customers Only', color: '#eab308', bg: '#fefce8' };
      if (toilet.accessType === 'free') return { text: 'Free to use', color: '#16a34a', bg: '#f0fdf4' };
      if (tags.fee === 'yes' || tags.charge === 'yes') return { text: 'Paid', color: '#9333ea', bg: '#f3e8ff' };
      if (tags.access === 'customers' || tags.fee === 'customers') return { text: 'Only for Customers', color: '#eab308', bg: '#fefce8' };
      return { text: 'Unknown', color: '#6b7280', bg: '#f9fafb' };
    };
    
    const getAccessibility = () => {
      if (toilet.accessibility === 'accessible') return { text: 'Wheelchair accessible', color: '#2563eb', bg: '#eff6ff' };
      if (toilet.accessibility === 'not-accessible') return { text: 'Not wheelchair accessible', color: '#dc2626', bg: '#fef2f2' };
      if (tags.wheelchair === 'yes') return { text: 'Wheelchair accessible', color: '#2563eb', bg: '#eff6ff' };
      if (tags.wheelchair === 'no') return { text: 'Not wheelchair accessible', color: '#dc2626', bg: '#fef2f2' };
      return { text: 'Unknown', color: '#6b7280', bg: '#f9fafb' };
    };
    
    const availability = getAvailability();
    const accessibility = getAccessibility();
    
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 280px; max-width: 350px; padding: 16px; background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);">
        <!-- 1. Title -->
        <h3 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 700; color: #1f2937; line-height: 1.3;">
          ${properTitle}
        </h3>
        
        <!-- Added by information for user-added toilets -->
        ${toilet.source === 'user' && toilet.addedByUserName ? `
        <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
          <div style="width: 6px; height: 6px; background: #3b82f6; border-radius: 50%; flex-shrink: 0;"></div>
          <span style="font-size: 11px; color: #6b7280; font-weight: 500;">
            Added by ${toilet.addedByUserName}
          </span>
        </div>
        ` : ''}
        
        <!-- 2. Rating and Reviews Summary -->
        <div id="review-summary-${toilet.id}" style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 3px;">
            <span style="color: #facc15; font-size: 16px;">☆☆☆☆☆</span>
            <span style="font-size: 14px; font-weight: 600; color: #374151;">0.0</span>
          </div>
          <span style="color: #6b7280; font-size: 12px;">(0 reviews)</span>
        </div>
        
        <!-- 3. Availability and Accessibility Indicators -->
        <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 12px; font-weight: 600; color: #374151; min-width: 70px;">Availability:</span>
            <span style="background: ${availability.bg}; color: ${availability.color}; padding: 3px 6px; border-radius: 4px; font-size: 11px; font-weight: 500;">
              ${availability.text}
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 12px; font-weight: 600; color: #374151; min-width: 70px;">Accessibility:</span>
            <span style="background: ${accessibility.bg}; color: ${accessibility.color}; padding: 3px 6px; border-radius: 4px; font-size: 11px; font-weight: 500;">
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
              oninput="window.handleTextareaChange('${toilet.id}', this.value)"
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
        
        <!-- 6. Reviews Section -->
        <div id="reviews-section-${toilet.id}" style="margin-bottom: 20px;">
          <!-- This will be populated by loadReviews function -->
          <div style="text-align: center; color: #6b7280; font-size: 14px; padding: 8px 0;">
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

  // Expose refresh function globally for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
              window.refreshMapData = () => {
          // Silent for performance
          // Simply refetch the data
          if (false) { // Disabled manual refetch for now
            // Manual refetch not needed with caching system
          }
        };
        
        // Add a simple test function
        window.testAPI = async () => {
          // Silent for performance
          try {
            const response = await fetch('/api/toilets');
            const data = await response.json();
            // Silent for performance
            return data;
          } catch (error) {
            console.error('❌ API test failed:', error);
            return null;
          }
        };
        
        // Add a force refresh function - NO CACHING, minimal logging
        window.forceRefreshToilets = () => {
          if (false) { // Disabled manual refetch for now
            // Manual refetch not needed with caching system
          }
        };
        
        // Add a simple refresh function - NO CACHING, minimal logging
        window.refreshToilets = () => {
          if (false) { // Disabled manual refetch for now
            // Manual refetch not needed with caching system
          }
        };
    }
  }, [toiletsError]);

  // Handle query errors
  useEffect(() => {
    const error = toiletsError;
    if (error) {
      const errMsg = (error as any)?.message || '';
      if (errMsg.includes('quota') || errMsg.includes('503')) {
        setFetchError('Service temporarily unavailable due to database limits. Please try again later.');
      } else {
        setFetchError('Could not load locations. Please try again later.');
      }
    } else {
      setFetchError(null);
    }
  }, [toiletsError]);

  // Handle review visibility state changes
  useEffect(() => {
    Object.entries(reviewVisibility).forEach(([toiletId, isVisible]) => {
      const reviewsContainer = document.getElementById(`reviews-${toiletId}`);
      if (reviewsContainer) {
        reviewsContainer.style.display = isVisible ? 'block' : 'none';
      }
      
      // Update toggle button arrow
      const toggleButton = document.querySelector(`button[onclick="window.toggleReviews('${toiletId}')"]`);
      if (toggleButton) {
        const arrow = toggleButton.querySelector('span:last-child');
        if (arrow) {
          arrow.textContent = isVisible ? '▲' : '▼';
        }
      }
    });
  }, [reviewVisibility]);

  // Restore review input state when popup is reopened
  useEffect(() => {
    Object.entries(reviewInputState).forEach(([toiletId, state]) => {
      if (state.visible) {
        // Restore rating stars
        for (let i = 1; i <= 5; i++) {
          const star = document.getElementById(`star-${toiletId}-${i}`);
          if (star) {
            star.innerHTML = '★';
            star.style.color = i <= state.rating ? '#facc15' : '#d1d5db';
            star.style.background = i <= state.rating ? '#fef3c7' : '#f3f4f6';
            star.style.borderColor = i <= state.rating ? '#f59e0b' : '#e5e7eb';
          }
        }
        
        // Show comment section and restore text
        const commentSection = document.getElementById(`review-comment-${toiletId}`);
        if (commentSection) {
          commentSection.style.display = 'block';
        }
        
        const textarea = document.getElementById(`comment-${toiletId}`) as HTMLTextAreaElement;
        if (textarea && state.text) {
          textarea.value = state.text;
        }
        
        // Restore current rating
        window.currentRating = { toiletId, rating: state.rating };
      }
    });
  }, [reviewInputState]);

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
      

      
      <div className="fixed bottom-6 left-6" style={{ zIndex: 1000 }}>
        {stableUserLocation && (
          <Button
            onClick={handleReturnToLocation}
            className="bg-white text-blue-600 shadow-xl rounded-full p-0 border border-gray-200 transition-all duration-200 hover:scale-105 hover:bg-blue-50 hover:border-blue-300 active:scale-95 floating-button"
            variant="outline"
            title="Return to my location"
            style={{ position: 'fixed', bottom: '36px', left: '24px', zIndex: 1000, width: '55px', height: '55px' }}
          >
            <Crosshair className="w-6 h-6" />
          </Button>
        )}
      </div>

      {fetchError && (
        <div className="absolute top-4 left-4 right-4 bg-red-100 text-red-800 p-4 rounded shadow-lg z-[1000]">
          {fetchError}
        </div>
      )}

      <LoadingScreen isLoading={toiletsLoading} toiletCount={allToiletsCount} />
      

      

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