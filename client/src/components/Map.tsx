import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Crosshair, Plus } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToiletCache } from '@/hooks/useToiletCache';
import { useDeleteToilet, useAddReview } from '@/hooks/useToilets';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { notify } from '@/lib/notify';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { useQueryClient } from '@tanstack/react-query';
import type { Toilet, MapLocation } from '@/types/toilet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { haptics } from '@/lib/haptics';
import { LoadingScreen } from './LoadingScreen';
import { clusterPoints, isCluster, getClusterStyle, getClusterBounds, type ClusterPoint, type Cluster } from '@/utils/clustering';
// @ts-ignore
window.L = L;

// Escape user-controlled values before injecting them into popup innerHTML.
// Prevents stored XSS via toilet titles, names, and review text.
const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

interface MapProps {
  onToiletClick: (toilet: Toilet) => void;
  onAddToiletClick: (location: MapLocation) => void;
  onLoginClick: () => void;
  onReportClick?: (toilet: Toilet) => void;
  onMapReady?: (flyToToilet: (toiletId: string) => boolean) => void;
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
    loadReviews: (toiletId: string, force?: boolean) => void;
    toggleReviews: (toiletId: string) => void;
    restoreReviewState: (toiletId: string) => void;
    openLoginModal: () => void;
    getCurrentUser: () => any;
    currentRating?: { toiletId: string; rating: number };
    reportToiletNotExists: (toiletId: string) => void;
    editToilet: (toiletId: string) => void;
    deleteToilet: (toiletId: string) => void;
    refreshMapData: () => void;
    testAPI: () => Promise<any>;
    forceRefreshToilets: () => void;
    refreshToilets: () => void;
    clearToiletCache: () => void;
    currentEditingToilet?: any;
  }
}

// Short-lived cache for popup reviews. The Leaflet popups call window.loadReviews
// imperatively on every open AND on every reopen after a pan/zoom — without this,
// each map move re-fetches reviews for the open marker. Module scope so it survives
// component remounts; pass force=true (after submitting a review) to bypass it.
// NOTE: `Map` is shadowed in this module by `export const Map` below, so use the
// global constructor explicitly to avoid a temporal-dead-zone reference error.
const reviewsCache = new globalThis.Map<string, { data: any[]; ts: number }>();
const REVIEWS_CACHE_TTL_MS = 30 * 1000;

const MapComponent = ({ onToiletClick, onAddToiletClick, onLoginClick, onReportClick, onMapReady, isAdmin, currentUser, isAddingToilet }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  
  // Function to translate toilet types from backend tags to proper translations
  const translateToiletType = (type: string): string => {
    const typeMap: Record<string, string> = {
      'public': t('toiletType.public'),
      'restaurant': t('toiletType.restaurant'),
      'cafe': t('toiletType.cafe'),
      'gas_station': t('toiletType.gasStation'),
      'gasStation': t('toiletType.gasStation'),
      'train_station': t('toiletType.trainStation'),
      'trainStation': t('toiletType.trainStation'),
      'bus_station': t('toiletType.busStation'),
      'busStation': t('toiletType.busStation'),
      'mall': t('toiletType.mall'),
      'other': t('toiletType.other')
    };
    
    return typeMap[type] || typeMap[type.replace('-', '_')] || type.replace('-', ' ');
  };
  const map = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const userMarker = useRef<any>(null);
  
  const userRingMarker = useRef<any>(null);
  const toiletMarkers = useRef<Array<{ toiletId: string; marker: any }>>([]);
  // Leaflet is bundled (import at top) and ready synchronously — no async CDN load.
  const [leafletLoaded] = useState(true);
  const [isAwayFromUser, setIsAwayFromUser] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<any>(null);
  
  // Update map cursor and re-register click handler when isAddingToilet changes
  useEffect(() => {
    if (map.current) {
      const mapElement = map.current.getContainer();
      if (mapElement) {
        mapElement.style.cursor = isAddingToilet ? 'crosshair' : 'grab';
      }
      
      // Re-register the click handler with updated props
      const handleMapClick = (e: any) => {
        const { lat, lng } = e.latlng;
        onAddToiletClick({ lat, lng });
      };
      
      // Remove old click handler and add new one
      map.current.off('click');
      map.current.on('click', handleMapClick);
      
      console.log("🗺️ Map click handler updated, isAddingToilet:", isAddingToilet);
    }
  }, [isAddingToilet, onAddToiletClick]);
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
  const { toilets, allToiletsCount, isLoading: toiletsLoading, error: toiletsError, refetch } = useToiletCache(boundParams, mapZoom);
  
  // Cache system status available for debugging if needed
  
  // Track map zoom level for clustering with debouncing
  useEffect(() => {
    if (map.current) {
      let timeoutId: NodeJS.Timeout;
      
      const handleZoomEnd = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          const zoom = map.current?.getZoom();
          if (zoom !== undefined) {
            setMapZoom(zoom);
          }
        }, 100); // Small delay to prevent rapid zoom updates
      };
      
      map.current.on('zoomend', handleZoomEnd);
      
      return () => {
        clearTimeout(timeoutId);
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

  // Auto-request location on component mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  // NOTE: a redundant preloadToiletsForRegion() spatial fetch used to run here on
  // first geolocation. It was removed — useToiletCache already loads the full list,
  // so the preload was a duplicate Supabase read for no benefit.

  // Leaflet is bundled via `import L from 'leaflet'` + `'leaflet/dist/leaflet.css'`
  // (top of this file) and exposed as window.L, so it's available synchronously.
  // We intentionally no longer pull it from a third-party CDN (unpkg) — that removed
  // a supply-chain dependency and let us tighten the CSP. `leafletLoaded` defaults
  // to true, so no loader effect is needed here.

  // Set up global functions for popup buttons
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // No development logging for performance
      
      // No cache clearing shortcut - caching removed

      window.getDirections = (lat, lng) => {
        haptics.medium();
        
        // Use geo: URL to trigger native OS app selection
        const geoUrl = `geo:${lat},${lng}?q=${lat},${lng}`;
        
        // Try to open geo: URL first (works on mobile)
        window.location.href = geoUrl;
        
        // Fallback for desktop - Google Maps
        setTimeout(() => {
          const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
          window.open(fallbackUrl, '_blank');
        }, 500);
      };

      window.loadReviews = async (toiletId, force = false) => {
        try {
          let reviews: any[];
          const cached = reviewsCache.get(toiletId);
          if (!force && cached && Date.now() - cached.ts < REVIEWS_CACHE_TTL_MS) {
            reviews = cached.data;
          } else {
            const response = await fetch(`/api/toilets/${toiletId}/reviews`);
            if (!response.ok) return;
            reviews = await response.json();
            reviewsCache.set(toiletId, { data: reviews, ts: Date.now() });
          }

          const section = document.getElementById(`reviews-section-${toiletId}`);
          if (!section) return;

          const count = reviews.length;
          const avg = count > 0 ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / count : 0;
          const rounded = Math.round(avg);
          const reviewLabel = count === 1 ? t('popup.review') : t('popup.reviews');

          const summaryStars = [1, 2, 3, 4, 5]
            .map(i => i <= rounded
              ? `<span>★</span>`
              : `<span class="text-slate-200">★</span>`)
            .join('');

          const listHtml = count > 0
            ? reviews.slice(0, 12).map((review: any) => {
                const filled = '★'.repeat(review.rating);
                const empty = '<span class="text-slate-200">★</span>'.repeat(5 - review.rating);
                let dateStr = '';
                try { dateStr = new Date(review.createdAt).toLocaleDateString('bg-BG'); } catch (e) { dateStr = ''; }
                return `
                  <div class="mb-2.5 last:mb-0 p-3 bg-white rounded-xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                    <div class="flex justify-between items-center mb-1.5">
                      <span class="font-bold text-[12px] text-slate-800">${escapeHtml(review.userName || '')}</span>
                      <div class="flex text-[10px] items-center gap-1.5">
                        <span class="text-amber-400 flex tracking-widest">${filled}${empty}</span>
                        <span class="text-slate-400 font-medium">${dateStr}</span>
                      </div>
                    </div>
                    ${review.text ? `<p class="text-[12px] text-slate-600 leading-snug">${escapeHtml(review.text)}</p>` : ''}
                  </div>`;
              }).join('')
            : `<p class="text-[11px] text-slate-500 italic pb-2 text-center">${t('popup.noReviews')}</p>`;

          section.innerHTML = `
            <div ${count > 0 ? `onclick="window.toggleReviews('${toiletId}')"` : ''} class="mx-4 mt-3 mb-2 px-3 py-2.5 bg-slate-50/50 border border-slate-100 rounded-xl ${count > 0 ? 'cursor-pointer hover:bg-slate-100/50 transition-colors group shadow-sm' : ''}">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="text-[34px] font-bold text-slate-900 leading-[0.8] tracking-tight">${avg > 0 ? avg.toFixed(1) : '0.0'}</div>
                  <div class="flex flex-col justify-center gap-[4px] mt-1">
                    <div class="flex text-amber-400 text-[15px] leading-none">${summaryStars}</div>
                    <div class="text-[11px] text-slate-500 font-medium leading-none">${count} ${reviewLabel}</div>
                  </div>
                </div>
                ${count > 0 ? `<div class="w-6 h-6 rounded-full bg-white flex items-center justify-center text-slate-400 border border-slate-200 shadow-sm group-hover:border-slate-300 transition-all">
                  <svg id="chevron-${toiletId}" width="14" height="14" class="transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>
                </div>` : ''}
              </div>
            </div>
            <div id="reviews-${toiletId}" class="hidden px-4 mb-2 max-h-[170px] overflow-y-auto reviews-scrollable">
              ${listHtml}
            </div>
          `;

          // Restore state after reviews are loaded and DOM is updated
          setTimeout(() => {
            window.restoreReviewState(toiletId);
          }, 50);
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
          
          // Reload reviews — force-bypass the cache so the new review shows immediately
          window.loadReviews(toiletId, true);

          // Show success message
          notify.success(t('toast.reviewSubmitted'));
        } catch (error) {
          console.error('📝 Client: Error submitting review:', error);
          notify.error(t('toast.reviewError'));
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
              reviewsContainer.classList.remove('hidden');
            }

            // Rotate the chevron to expanded state
            const chevron = document.getElementById(`chevron-${toiletId}`);
            if (chevron) {
              chevron.classList.add('rotate-180');
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
          
          // Find the toilet object
          const toilet = toilets.find(t => t.id === toiletId);
          if (!toilet) {
            console.error('Toilet not found:', toiletId);
            return;
          }
          
          // Use the callback to open the report modal
          if (onReportClick) {
            onReportClick(toilet);
          }
        };

      window.editToilet = async (toiletId) => {
        haptics.light();
        if (!user) {
          onLoginClick();
          return;
        }
        
        // Find the toilet data
        const toilet = toilets.find(t => t.id === toiletId);
        if (!toilet) {
          notify.error(t('admin.toiletNotFound'));
          return;
        }
        
        // Check if user can edit (admin or creator)
        if (!isAdmin && toilet.userId !== user.uid) {
          notify.error(t('toast.editPermission'));
          return;
        }
        
        // Close the popup
        const popup = document.querySelector('.leaflet-popup');
        if (popup) {
          (popup as any).remove();
        }
        
        // Trigger edit mode by setting global edit state
        if (typeof window !== 'undefined') {
          window.currentEditingToilet = toilet;
          window.dispatchEvent(new CustomEvent('openEditModal', { detail: toilet }));
        }
      };

      window.deleteToilet = async (toiletId) => {
        haptics.warning();
        if (!user) {
          onLoginClick();
          return;
        }
        
        // Find the toilet to check permissions
        const toilet = toilets.find(t => t.id === toiletId);
        if (!toilet) {
          notify.error(t('admin.toiletNotFound'));
          return;
        }
        
        // Check if user can delete (admin or creator)
        if (!isAdmin && toilet.userId !== user.uid) {
          notify.error(t('toast.deletePermission'));
          return;
        }
        
        const confirmedDelete = await confirmDialog({
          title: t('confirm.deleteToilet.title'),
          description: t('confirm.deleteToilet.body'),
          confirmText: t('button.delete'),
          cancelText: t('button.cancel'),
          variant: 'destructive',
        });
        if (confirmedDelete) {
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
            
            // Show success message
            notify.success(t('toast.toiletDeleted'));
          } catch (error) {
            console.error('Error deleting toilet:', error);
            notify.error(t('toast.deleteError'));
          }
        }
      };

      // Add cache clearing function for debugging
      window.clearToiletCache = () => {
        // Cache clearing functionality will be handled by parent component
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

    // Start with user location if available, otherwise Sofia center
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

      // Debounce function for map events - improved performance
  let mapMoveTimeout: NodeJS.Timeout | undefined;
  let mapMoveStartTimeout: NodeJS.Timeout | undefined;
  
  // Handle map events for bounds tracking
  const handleMapMove = () => {
    // Set moving state immediately
    setIsMapMoving(true);
    
    // Clear existing timeouts
    clearTimeout(mapMoveTimeout);
    clearTimeout(mapMoveStartTimeout);
    
    // Adaptive debounce based on zoom level for better performance
    const currentZoom = map.current?.getZoom() || 14;
    const debounceTime = currentZoom < 12 ? 1000 : currentZoom < 15 ? 600 : 300;
    
    mapMoveTimeout = setTimeout(() => {
      const bounds = map.current.getBounds();
      setMapBounds(bounds);
      setIsMapMoving(false);
    }, debounceTime); // Adaptive debounce for performance
      
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

    // Initialize bounds immediately for instant pin loading
    const initialBounds = map.current.getBounds();
    setMapBounds(initialBounds);
    
    // Force immediate toilet fetch on map load with more aggressive mobile loading
    const triggerToiletLoad = () => {
      if (map.current) {
        const bounds = map.current.getBounds();
        setMapBounds(bounds);
      }
    };
    
    // Immediate trigger
    triggerToiletLoad();
    
    // Quick follow-up for mobile
    setTimeout(() => {
      triggerToiletLoad();
    }, 50);
    
    // Additional triggers for mobile reliability
    setTimeout(() => {
      triggerToiletLoad();
    }, 200);
    
    setTimeout(() => {
      triggerToiletLoad();
    }, 500);
    
    // Final trigger for stubborn mobile cases
    setTimeout(() => {
      triggerToiletLoad();
    }, 1000);

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
        
        // CRITICAL: Clear marker references when map is removed
        userMarker.current = null;
        userRingMarker.current = null;
        markersLayer.current = null;
        toiletMarkers.current = [];
        lastUserLocation.current = null;
        userLocationSet.current = false; // Reset location set flag
      }
    };
  }, [leafletLoaded, stableUserLocation ? 'has-location' : 'no-location']); // Only re-init if location availability changes

  // Expose flyToToilet function to parent component (for admin search)
  useEffect(() => {
    if (!map.current || !leafletLoaded || !onMapReady) return;

    const flyToToilet = (toiletId: string): boolean => {
      // Search in the FULL cache, not just visible toilets
      const allToiletsCache = queryClient.getQueryData<Toilet[]>(['all-toilets']) || [];
      const toilet = allToiletsCache.find(t => t.id === toiletId);
      
      if (!toilet) {
        console.log('🔍 Toilet not found in cache. ID:', toiletId);
        console.log('📊 Total toilets in cache:', allToiletsCache.length);
        return false;
      }

      console.log('✅ Toilet found! Flying to:', toilet.title, toilet.coordinates);

      // Fly to the toilet location
      map.current?.flyTo(
        [toilet.coordinates.lat, toilet.coordinates.lng],
        17, // Zoom level
        {
          duration: 1.5,
          easeLinearity: 0.25
        }
      );

      // Mark this toilet as the one to open. The marker-restore logic reopens it
      // once its marker is rendered for the new viewport (handles the case where
      // the marker doesn't exist yet because the toilet was off-screen).
      manuallyClosedPopupRef.current = false;
      openPopupToiletIdRef.current = toiletId;

      // Also try directly after the fly animation, in case the marker already exists.
      setTimeout(() => {
        const marker = toiletMarkers.current.find(m => m.toiletId === toiletId);
        if (marker && marker.marker) {
          marker.marker.openPopup();
        }
      }, 1600);

      return true;
    };

    // Call the callback to expose the function
    onMapReady(flyToToilet);
  }, [map.current, leafletLoaded, onMapReady, queryClient]);

  // Close any open toilet popup when the rest of the app asks (e.g. the user
  // taps the locate button or opens a menu item). Dispatched from App.tsx.
  useEffect(() => {
    const closePopups = () => {
      manuallyClosedPopupRef.current = true;
      openPopupToiletIdRef.current = null;
      map.current?.closePopup();
    };
    window.addEventListener('toaletna:close-popups', closePopups);
    return () => window.removeEventListener('toaletna:close-popups', closePopups);
  }, []);

  const userLocationSet = useRef(false);
  const lastUserLocation = useRef<{lat: number, lng: number} | null>(null);

  // Create and manage user location indicator - COMPLETELY INDEPENDENT
  useEffect(() => {
    if (!map.current || !leafletLoaded || !stableUserLocation) {
      return;
    }

    // Check if location actually changed to prevent duplicate updates
    if (lastUserLocation.current && 
        Math.abs(lastUserLocation.current.lat - stableUserLocation.lat) < 0.0001 && 
        Math.abs(lastUserLocation.current.lng - stableUserLocation.lng) < 0.0001) {
      return;
    }

    // If marker exists and is still valid, just update its position smoothly
    if (userMarker.current) {
      try {
        // Check if marker is still valid (hasn't been removed from map)
        userMarker.current.setLatLng([stableUserLocation.lat, stableUserLocation.lng]);
        lastUserLocation.current = { lat: stableUserLocation.lat, lng: stableUserLocation.lng };
        return;
      } catch (error) {
        // Marker was removed, clear reference and recreate below
        userMarker.current = null;
      }
    }

    // Create or recreate the location indicator
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

    lastUserLocation.current = { lat: stableUserLocation.lat, lng: stableUserLocation.lng };
  }, [stableUserLocation?.lat, stableUserLocation?.lng, leafletLoaded]); // Independent location indicator

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
    
    // Google Maps style clustering system
    const currentZoom = map.current?.getZoom() || 14;
    
    // Convert toilets to cluster points
    const clusterPointsArray: ClusterPoint[] = filteredToilets
      .filter(toilet => toilet.coordinates && toilet.coordinates.lat && toilet.coordinates.lng)
      .map(toilet => ({
        lat: toilet.coordinates.lat,
        lng: toilet.coordinates.lng,
        id: toilet.id,
        data: toilet
      }));
    
    // Apply clustering - conservative approach that mirrors Google Maps behavior
    const clusteredItems = clusterPoints(clusterPointsArray, currentZoom, {
      gridSize: currentZoom <= 4 ? 50 : currentZoom <= 6 ? 80 : currentZoom <= 8 ? 120 : currentZoom <= 10 ? 150 : 200,
      maxZoom: 10, // Only cluster at very low zoom levels (country/regional view)
      minimumClusterSize: currentZoom <= 4 ? 2 : currentZoom <= 6 ? 3 : currentZoom <= 8 ? 5 : 8 // More toilets needed at higher zoom
    });

    // Clustering applied successfully
    
    // Filter by viewport with buffer for better coverage
    const mapBounds = map.current?.getBounds();
    const viewportToilets = clusteredItems.filter((item: ClusterPoint | Cluster) => {
      if (!mapBounds) return true;
      
      // Add buffer around viewport (roughly 20% on each side)
      const latBuffer = (mapBounds.getNorth() - mapBounds.getSouth()) * 0.2;
      const lngBuffer = (mapBounds.getEast() - mapBounds.getWest()) * 0.2;
      
      const expandedBounds = L.latLngBounds(
        L.latLng(mapBounds.getSouth() - latBuffer, mapBounds.getWest() - lngBuffer),
        L.latLng(mapBounds.getNorth() + latBuffer, mapBounds.getEast() + lngBuffer)
      );
      
      if (isCluster(item)) {
        return expandedBounds.contains(L.latLng(item.lat, item.lng));
      } else {
        return expandedBounds.contains(L.latLng(item.lat, item.lng));
      }
    }); // No limit - show all toilets in expanded viewport
    
    // Viewport filtering applied
    
    viewportToilets.forEach((item: ClusterPoint | Cluster) => {
      try {
        let marker: any;
        let coordinates: { lat: number; lng: number };
        let toiletData: any;
        
        if (isCluster(item)) {
          // Handle cluster
          coordinates = { lat: item.lat, lng: item.lng };
          const style = getClusterStyle(item.count);
          
          const icon = L.divIcon({
            className: 'cluster-marker',
            html: createClusterMarkerHTML(item.count, style),
            iconSize: [style.size, style.size],
            iconAnchor: [style.size / 2, style.size / 2]
          });
          
          marker = L.marker([coordinates.lat, coordinates.lng], { 
            icon,
            keyboard: false,
            title: `${item.count} toilets`
          }).addTo(markersLayer.current);
          
          // Handle cluster click - zoom in to show individual markers
          marker.on('click', () => {
            haptics.light();
            if (map.current) {
              const bounds = getClusterBounds(item);
              // Calculate appropriate zoom level
              const latDiff = bounds.north - bounds.south;
              const lngDiff = bounds.east - bounds.west;
              const maxDiff = Math.max(latDiff, lngDiff);
              
              let targetZoom = 16;
              if (maxDiff > 0.01) targetZoom = 13;
              else if (maxDiff > 0.005) targetZoom = 14;
              else if (maxDiff > 0.002) targetZoom = 15;
              
              map.current.setView([item.lat, item.lng], targetZoom);
            }
          });
          
        } else {
          // Handle individual toilet
          const toilet = item.data;
          coordinates = { lat: item.lat, lng: item.lng };
          toiletData = toilet;
          
          // Category colors (matches the map legend / pin redesign)
          const markerColor = getToiletMarkerColor(toilet);
          
          // Performance optimization: simpler markers at lower zoom levels
          const useSimpleMarker = currentZoom < 13;
          const icon = L.divIcon({
            className: useSimpleMarker ? 'toilet-marker-simple' : 'toilet-pin-marker',
            html: createToiletMarkerHTML(toilet, markerColor, useSimpleMarker),
            iconSize: useSimpleMarker ? [24, 24] : [44, 54],
            iconAnchor: useSimpleMarker ? [12, 12] : [22, 52],
            popupAnchor: useSimpleMarker ? [0, -12] : [0, -28]
          });

          marker = L.marker([coordinates.lat, coordinates.lng], { 
            icon,
            keyboard: false,
            title: toilet.title || 'Toilet'
          }).addTo(markersLayer.current);
          
          // Regular toilet marker - show popup
          marker.bindPopup(createToiletPopupHTML(toilet), {
            maxWidth: 300,
            minWidth: 300,
            className: 'modern-toilet-popup',
            closeButton: true,
            offset: [0, -20],
            autoPan: true,
            keepInView: true,
            autoPanPadding: [40, 40]
          });
          
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
        }
      } catch (error) {
        console.error(`❌ Error creating marker:`, error);
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
        toilets.find(t => t.id === m.toiletId && t.source === 'osm')
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
  const createClusterMarkerHTML = (count: number, style: { size: number; color: string; textColor: string; fontSize: string }) => {
    return `
      <div style="
        width: ${style.size}px;
        height: ${style.size}px;
        background: ${style.color};
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(0,0,0,0.35);
        font-weight: bold;
        color: ${style.textColor};
        font-size: ${style.fontSize};
        cursor: pointer;
        transition: transform 0.2s ease;
      " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
        ${count}
      </div>
    `;
  };

  const createToiletMarkerHTML = (toilet: any, markerColor: string, useSimpleMarker = false) => {
    // Simple marker for performance at low zoom levels
    if (useSimpleMarker) {
      return `
        <div style="
          width: 20px;
          height: 20px;
          background: ${markerColor};
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        "></div>
      `;
    }

    // Clean, classic colored teardrop pin with a "WC" core
    return `
      <div class="relative w-[44px] h-[54px] cursor-pointer group flex justify-center origin-bottom transition-transform duration-200">
        <div class="absolute bottom-[4px] left-1/2 -translate-x-1/2 w-[14px] h-[4px] bg-slate-900/50 rounded-[100%] blur-[1.5px] group-hover:w-[20px] group-hover:bg-slate-900/30 group-hover:blur-[2px] transition-all duration-300 pointer-events-none z-0"></div>
        <div class="absolute bottom-[8px] w-[38px] h-[38px] flex items-center justify-center group-hover:-translate-y-[4px] group-active:scale-[0.9] transition-all duration-300 drop-shadow-[0_6px_12px_rgba(0,0,0,0.32)] z-10">
          <div class="w-[38px] h-[38px] rounded-[50%_50%_0_50%] rotate-45 flex items-center justify-center shadow-[inset_0_-2px_8px_rgba(0,0,0,0.15)] ring-1 ring-black/5" style="background-color: ${markerColor};">
            <div class="w-[28px] h-[28px] bg-white rounded-full -rotate-45 flex items-center justify-center shadow-sm relative">
              <span class="text-[12px] font-bold text-slate-800 leading-none absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-[45%] tracking-tight">WC</span>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const createToiletPopupHTML = (toilet: Toilet) => {
    const tags = toilet.tags as any || {};
    
    // The old server baked hardcoded ENGLISH auto-titles into the DB
    // ("Public Toilet", "Mall Toilet", …). Treat those as "no custom title"
    // so they fall through and get localized from the type below — this makes
    // the popup title respect the language regardless of server restarts or
    // legacy rows still holding an English string.
    const legacyAutoTitles = [
      'public toilet', 'ekotoi', 'restaurant toilet', 'cafe toilet',
      'gas station toilet', 'mall toilet', 'toilet'
    ];

    // Get proper title based on type and custom title
    const getProperTitle = () => {
      const custom = (toilet.title || '').trim();
      if (custom !== '' && !legacyAutoTitles.includes(custom.toLowerCase())) {
        return custom;
      }
      if (tags.name) return tags.name;
      if (tags.operator && toilet.type === 'gas-station') return `${t('popup.toiletAt')} ${tags.operator} ${t('popup.gasStation')}`;
      if (tags.brand && toilet.type === 'gas-station') return `${t('popup.toiletAt')} ${tags.brand} ${t('popup.gasStation')}`;
      if (toilet.type === 'mall') return `${t('popup.toiletIn')} ${t('popup.shoppingMall')}`;
      if (toilet.type === 'restaurant') return `${t('popup.toiletIn')} ${t('popup.restaurant')}`;
      if (toilet.type === 'cafe') return `${t('popup.toiletIn')} ${t('popup.cafe')}`;
      if (toilet.type === 'gas-station') return `${t('popup.toiletAt')} ${t('popup.gasStation')}`;
      if (toilet.type === 'EKOTOI') return t('toiletType.EKOTOI');
      if (toilet.type === 'bus_station' || toilet.type === 'bus-station') return `${t('popup.toiletAt')} ${t('toiletType.busStation')}`;
      if (toilet.type === 'train_station' || toilet.type === 'train-station') return `${t('popup.toiletAt')} ${t('toiletType.trainStation')}`;
      return t('popup.publicToilet');
    };
    
    const properTitle = getProperTitle();
    
    // Determine availability and accessibility based on database fields or tags
    const getAvailabilityBadge = () => {
      if (toilet.accessType === 'paid' || tags.fee === 'yes' || tags.charge === 'yes') return { text: t('popup.paidAccess'), cls: 'bg-purple-100 text-purple-700 border-purple-200/50' };
      if (toilet.accessType === 'customers-only' || tags.access === 'customers' || tags.fee === 'customers') return { text: t('popup.customersOnly'), cls: 'bg-amber-100 text-amber-700 border-amber-200/50' };
      if (toilet.accessType === 'free') return { text: t('popup.freeToUse'), cls: 'bg-emerald-100 text-emerald-700 border-emerald-200/50' };
      return { text: t('popup.unknown'), cls: 'bg-slate-200 text-slate-700 border-slate-300/50' };
    };

    const getAccessibilityBadge = () => {
      if (toilet.accessibility === 'accessible' || tags.wheelchair === 'yes') return { text: t('popup.wheelchairAccessible'), cls: 'bg-blue-100 text-blue-700 border-blue-200/50' };
      if (toilet.accessibility === 'not-accessible' || tags.wheelchair === 'no') return { text: t('popup.notWheelchairAccessible'), cls: 'bg-red-100 text-red-700 border-red-200/50' };
      return { text: t('popup.unknown'), cls: 'bg-slate-200 text-slate-700 border-slate-300/50' };
    };
    
    const availability = getAvailabilityBadge();
    const accessibility = getAccessibilityBadge();
    const canEdit = !!(isAdmin || (currentUser && currentUser.uid === toilet.userId));

    // SVG icons.
    // NOTE: explicit width/height attributes are intentional. These icons are
    // injected as raw innerHTML (outside React) and must NOT depend on Tailwind
    // utilities (e.g. w-[14px]) for their size — if that class is ever missing
    // from the bundle or the CSS hasn't loaded yet, an attribute-less SVG
    // balloons to fill its container. Attributes keep the size robust.
    const directionsIcon = `<svg width="14" height="14" class="mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>`;
    const editIcon = `<svg width="14" height="14" class="mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
    const reportIcon = `<svg width="14" height="14" class="mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    const deleteIcon = `<svg width="14" height="14" class="mb-0.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;

    // Header gradient by category
    const headerClasses = toilet.hasBabyChanging ? 'from-pink-50/70 to-white' :
                          toilet.type === 'gas-station' ? 'from-red-50/50 to-white' :
                          toilet.type === 'EKOTOI' ? 'from-emerald-50/50 to-white' :
                          'from-indigo-50/40 to-white';

    const directionsButton = (full: boolean) => `
      <button onclick="window.getDirections(${toilet.coordinates.lat}, ${toilet.coordinates.lng})" class="${full ? 'w-full' : 'flex-1'} flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl font-bold text-[13px] tracking-wide transition-all active:scale-[0.98] shadow-[0_2px_8px_rgba(37,99,235,0.3)]" style="min-height:0;min-width:0;padding-top:8px;padding-bottom:8px;font-size:13px;height:auto">
        ${directionsIcon}
        ${t('popup.directions')}
      </button>`;

    const secondaryButton = (onClick: string, icon: string, label: string) => `
      <button onclick="${onClick}" class="flex-1 flex flex-col gap-0.5 items-center justify-center py-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.1)] active:scale-[0.98] transition-all uppercase tracking-wider text-[9px] font-bold" style="min-height:0;min-width:0;padding-top:6px;padding-bottom:6px;font-size:9px;height:auto">
        ${icon}
        ${label}
      </button>`;

    const actionsHtml = canEdit ? `
      ${directionsButton(true)}
      <div class="flex gap-1.5">
        ${secondaryButton(`window.editToilet('${toilet.id}')`, editIcon, t('popup.edit'))}
        ${secondaryButton(`window.reportToiletNotExists('${toilet.id}')`, reportIcon, t('popup.report'))}
        ${secondaryButton(`window.deleteToilet('${toilet.id}')`, deleteIcon, t('popup.delete'))}
      </div>
    ` : `
      <div class="flex gap-1.5 items-stretch">
        ${directionsButton(false)}
        <button onclick="window.reportToiletNotExists('${toilet.id}')" class="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 text-slate-600 border border-slate-200 py-2 rounded-xl font-bold text-[13px] tracking-wide shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.1)] active:scale-[0.98] transition-all" style="min-height:0;min-width:0;padding-top:8px;padding-bottom:8px;font-size:13px;height:auto">
          ${reportIcon}
          ${t('popup.report')}
        </button>
      </div>
    `;

    return `
      <div class="font-sans text-slate-800 w-[290px] pb-0 flex flex-col max-h-[85vh] relative">
        <div class="flex flex-col overflow-hidden">
          <div class="overflow-y-auto no-scrollbar pb-2">

            <!-- Header -->
            <div class="relative px-4 pt-3 pb-3 bg-gradient-to-br ${headerClasses}">
              <div class="flex items-start justify-between gap-3 mb-2 pr-6">
                <h3 class="text-[16px] font-bold text-slate-900 leading-tight tracking-tight">${escapeHtml(properTitle)}</h3>
              </div>
              <div class="flex flex-wrap gap-1.5 mb-2">
                <span class="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white shadow-sm border border-blue-700/20">${translateToiletType(toilet.type)}</span>
                ${toilet.hasBabyChanging ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-pink-100 text-pink-700 border border-pink-200/60 shadow-sm">👶 ${t('toiletType.hasBabyChangingBadge')}</span>` : ''}
              </div>
              ${(toilet.source === 'user' && toilet.addedByUserName) ? `
              <div class="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold mt-1">
                <div class="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_4px_rgba(99,102,241,0.5)]"></div>
                ${t('popup.addedBy')} ${escapeHtml(toilet.addedByUserName)}
              </div>` : ''}
            </div>

            <!-- Availability & Access -->
            <div class="px-4 py-2.5 flex flex-col gap-2 bg-slate-50/50 border-t border-slate-100">
              <div class="flex items-center gap-3">
                <span class="text-[11px] font-bold text-slate-500 min-w-[70px]">${t('popup.availability')}</span>
                <span class="${availability.cls} px-1.5 py-0.5 rounded-[4px] text-[11px] font-semibold shadow-sm border">${availability.text}</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-[11px] font-bold text-slate-500 min-w-[70px]">${t('popup.accessibility')}</span>
                <span class="${accessibility.cls} px-1.5 py-0.5 rounded-[4px] text-[11px] font-semibold shadow-sm border">${accessibility.text}</span>
              </div>
            </div>

            <!-- Reviews summary + list (populated by loadReviews) -->
            <div id="reviews-section-${toilet.id}">
              <div class="mx-4 mt-3 mb-2 px-3 py-2.5 bg-slate-50/50 border border-slate-100 rounded-xl">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="text-[34px] font-bold text-slate-900 leading-[0.8] tracking-tight">0.0</div>
                    <div class="flex flex-col justify-center gap-[4px] mt-1">
                      <div class="flex text-amber-400 text-[15px] leading-none">${'<span class="text-slate-200">★</span>'.repeat(5)}</div>
                      <div class="text-[11px] text-slate-500 font-medium leading-none">0 ${t('popup.reviews')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Divider -->
            <div class="h-px bg-slate-100 mx-4 w-[calc(100%-32px)] mt-5 mb-3 relative">
              <span class="absolute left-1/2 -top-[7px] -translate-x-1/2 bg-white px-1.5 whitespace-nowrap text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">${t('popup.rateThisToilet')}</span>
            </div>

            <!-- Rate Section -->
            <div class="px-4 pb-1">
              <div class="flex gap-1 justify-between mt-3 mb-1">
                ${[1,2,3,4,5].map(i => `
                  <button
                    onmouseover="window.hoverStars('${toilet.id}', ${i})"
                    onmouseout="window.resetStars('${toilet.id}')"
                    onclick="window.setRating('${toilet.id}', ${i})"
                    id="star-${toilet.id}-${i}"
                    class="flex-1 h-9 rounded-[8px] bg-white border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] text-slate-300 transition-all hover:shadow-[0_4px_6px_rgba(0,0,0,0.08)] flex items-center justify-center text-[22px] focus:outline-none"
                    style="height:36px;min-height:36px;max-height:36px;min-width:0;padding:0;font-size:22px;line-height:1"
                  >★</button>
                `).join('')}
              </div>

              <div id="review-comment-${toilet.id}" class="hidden mt-2 space-y-1.5">
                <textarea
                  id="comment-${toilet.id}"
                  placeholder="${t('popup.shareExperience')}"
                  oninput="window.handleTextareaChange('${toilet.id}', this.value)"
                  class="w-full text-[12px] p-2.5 rounded-lg border border-slate-200 bg-white shadow-inner focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all resize-none h-[60px] placeholder:text-slate-400"
                ></textarea>
                <div class="flex gap-1.5">
                  <button onclick="window.submitReview('${toilet.id}')" class="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-[0_2px_8px_rgba(37,99,235,0.3)] text-[11px] font-bold rounded-lg active:scale-[0.98]">${t('popup.submitReview')}</button>
                  <button onclick="window.cancelReview('${toilet.id}')" class="px-3 py-1.5 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-lg shadow-sm border border-slate-200 active:scale-[0.98]">${t('popup.cancel')}</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Fixed actions -->
          <div class="p-3 pt-3 flex flex-col gap-2 bg-white rounded-b-[16px] border-t border-slate-100 shadow-[0_-4px_10px_-10px_rgba(0,0,0,0.1)] shrink-0 z-10 relative">
            ${actionsHtml}
          </div>
        </div>
      </div>
    `;
  };

  const handleReturnToLocation = () => {
    // Always close any open toilet popup when using the locate control.
    manuallyClosedPopupRef.current = true;
    openPopupToiletIdRef.current = null;
    map.current?.closePopup();

    // Already have a location → just recenter on it.
    if (stableUserLocation && map.current) {
      map.current.setView([stableUserLocation.lat, stableUserLocation.lng], 16);
      setIsAwayFromUser(false);
      return;
    }

    // No location yet (e.g. the user declined earlier) → (re)request it. On most
    // browsers this re-prompts; if it's permanently blocked the promise rejects
    // and we point the user to their browser settings.
    getCurrentLocation(true)
      .then((loc: any) => {
        if (loc && map.current) {
          map.current.setView([loc.lat, loc.lng], 16);
          setIsAwayFromUser(false);
        }
      })
      .catch(() => {
        notify.error(t('toast.locationDenied'));
      });
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
          // Manual refresh function for debugging
          if (refetch && typeof refetch === 'function') {
            refetch();
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
        reviewsContainer.classList.toggle('hidden', !isVisible);
      }

      // Rotate the chevron icon based on visibility
      const chevron = document.getElementById(`chevron-${toiletId}`);
      if (chevron) {
        chevron.classList.toggle('rotate-180', isVisible);
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
      <style>{`
        /* GPU acceleration for map performance */
        .leaflet-container {
          transform: translateZ(0);
          will-change: transform;
        }
        /* User location indicator - optimized for smooth updates */
        .user-location-combined {
          transform: translate3d(0,0,0);
          will-change: transform;
          backface-visibility: hidden;
          z-index: 1000 !important;
        }
        .pulse-ring {
          width: 60px;
          height: 60px;
          border: 3px solid #3b82f6;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.1);
          position: absolute;
          top: 0;
          left: 0;
          animation: pulse 2s ease-out infinite;
          transform: translate3d(0,0,0);
        }
        .user-dot {
          width: 16px;
          height: 16px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) translate3d(0,0,0);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        @keyframes pulse {
          0% {
            transform: scale(0.3);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
        .toilet-marker-simple {
          transform: translate3d(0,0,0);
          will-change: transform;
          backface-visibility: hidden;
        }
        .toilet-marker {
          transform: translate3d(0,0,0);
          will-change: transform;
          backface-visibility: hidden;
        }
        .cluster-marker {
          transform: translate3d(0,0,0);
          will-change: transform;
          backface-visibility: hidden;
          contain: layout style paint;
        }
        .cluster-marker div {
          transform: translate3d(0,0,0);
          backface-visibility: hidden;
        }
        /* Optimize popup animations */
        .leaflet-popup {
          transform: translateZ(0);
        }
        /* Reduce paint complexity */
        .leaflet-marker-icon {
          image-rendering: optimizeSpeed;
        }
        /* Better rendering performance */
        .leaflet-tile {
          image-rendering: optimizeSpeed;
        }
        /* Loading states optimization */
        .leaflet-control-container {
          transform: translateZ(0);
        }
        /* Better scrolling performance */
        .leaflet-container {
          -webkit-overflow-scrolling: touch;
          overflow-scrolling: touch;
        }
        /* Optimize animations */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
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
      

      
      {/* Always visible: recenters when we have a location, or (re)requests it
          if the user previously declined — the only retry path on mobile. */}
      <div className="fixed bottom-6 left-6" style={{ zIndex: 1000 }}>
        <Button
          onClick={handleReturnToLocation}
          className="bg-white text-blue-600 shadow-xl rounded-full p-0 border border-gray-200 transition-all duration-200 hover:scale-105 hover:bg-blue-50 hover:border-blue-300 active:scale-95 floating-button"
          variant="outline"
          title={t('header.findLocation')}
          style={{ position: 'fixed', bottom: '36px', left: '24px', zIndex: 1000, width: '55px', height: '55px' }}
        >
          <Crosshair className="w-6 h-6" />
        </Button>
      </div>

      {fetchError && (
        <div className="absolute top-4 left-4 right-4 bg-red-100 text-red-800 p-4 rounded shadow-lg z-[1000]">
          {fetchError}
        </div>
      )}

      <LoadingScreen isLoading={toiletsLoading} />
      

      

    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const Map = memo(MapComponent);

export default Map;

// Category colors for map pins (matches the map legend in Guides)
function getToiletMarkerColor(toilet: any): string {
  if (toilet?.hasBabyChanging) return '#ff66c4'; // pink - baby changing

  // Normalise the type so that variants like "gas_station", "gasStation",
  // "GAS-STATION" all resolve to the same category.
  const type = String(toilet?.type || '')
    .toLowerCase()
    .replace(/[_\s]+/g, '-');

  if (type === 'ekotoi' || type === 'portable') return '#00bf63'; // green - portable / EKOTOI
  if (type === 'gas-station' || type === 'gasstation') return '#ff3131'; // red - gas station
  if (type === 'public') return '#5170ff'; // blue - public
  if (type === 'mall' || type === 'shop' || type === 'shops') return '#38b6ff'; // light blue - mall | shops
  if (type === 'cafe' || type === 'restaurant') return '#ffbd59'; // yellow - cafe | restaurant
  return '#ad52ec'; // purple - other
}

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