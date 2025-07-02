import { useEffect, useRef, useState, useMemo, memo } from "react";
import { Button } from "@/components/ui/button";
import { Crosshair, Plus } from "lucide-react";
import { useToilets } from "@/hooks/useToilets";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useAuth } from "@/hooks/useAuth";
import type { Toilet, MapLocation } from "@/types/toilet";

interface MapProps {
  onToiletClick: (toilet: Toilet) => void;
  onAddToiletClick: (location: MapLocation) => void;
  onLoginClick: () => void;
}

// Declare Leaflet types for global window object
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
  
  // Get user location when map component mounts
  useEffect(() => {
    getCurrentLocation();
  }, []);
  
  // Debug logging for user location
  useEffect(() => {
    console.log('Map component userLocation changed:', userLocation, 'loading:', locationLoading);
  }, [userLocation, locationLoading]);
  const { user } = useAuth();
  
  // Load all toilets initially to show complete coverage
  const { data: toilets = [] } = useToilets();
  
  // Memoize toilets to prevent unnecessary re-renders
  const stableToilets = useMemo(() => {
    return toilets.length > 0 ? toilets : [];
  }, [toilets.length, toilets]);

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

  // Set up global functions for popup buttons
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.getDirections = (lat: number, lng: number) => {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        window.open(url, '_blank');
      };

      (window as any).hoverStars = (toiletId: string, rating: number) => {
        const starsContainer = document.getElementById(`stars-${toiletId}`);
        if (starsContainer) {
          const stars = starsContainer.querySelectorAll('button');
          stars.forEach((star, index) => {
            const starElement = star as HTMLElement;
            if (index < rating) {
              starElement.style.color = '#fbbf24'; // bright yellow
              starElement.style.transform = 'scale(1.1)';
            } else {
              starElement.style.color = '#cbd5e1'; // gray-300
              starElement.style.transform = 'scale(1)';
            }
          });
        }
      };

      (window as any).resetStars = (toiletId: string) => {
        const currentRating = (window as any).currentRating;
        const starsContainer = document.getElementById(`stars-${toiletId}`);
        if (starsContainer) {
          const stars = starsContainer.querySelectorAll('button');
          const selectedRating = (currentRating && currentRating.toiletId === toiletId) ? currentRating.rating : 0;
          stars.forEach((star, index) => {
            const starElement = star as HTMLElement;
            if (index < selectedRating) {
              starElement.style.color = '#fbbf24'; // bright yellow
            } else {
              starElement.style.color = '#cbd5e1'; // gray-300
            }
            starElement.style.transform = 'scale(1)'; // reset scale
          });
        }
      };

      (window as any).setRating = (toiletId: string, rating: number) => {
        // Update star display
        const starsContainer = document.getElementById(`stars-${toiletId}`);
        const reviewForm = document.getElementById(`review-form-${toiletId}`);
        
        if (starsContainer && reviewForm) {
          // Update stars visual with yellow color
          const stars = starsContainer.querySelectorAll('button');
          stars.forEach((star, index) => {
            if (index < rating) {
              star.style.color = '#fbbf24'; // bright yellow
            } else {
              star.style.color = '#cbd5e1';
            }
          });
          
          // Show review form
          reviewForm.style.display = 'block';
          
          // Store rating temporarily
          (window as any).currentRating = { toiletId, rating };
        }
      };

      (window as any).submitReview = async (toiletId: string) => {
        const reviewInput = document.getElementById(`review-input-${toiletId}`) as HTMLTextAreaElement;
        const currentRating = (window as any).currentRating;
        
        if (!user) {
          alert('Please sign in to leave a review');
          return;
        }
        
        if (!currentRating || currentRating.toiletId !== toiletId) {
          alert('Please select a rating first');
          return;
        }

        try {
          const response = await fetch(`/api/toilets/${toiletId}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rating: currentRating.rating,
              text: reviewInput.value.trim() || undefined,
              userId: user.uid || user.email || 'anonymous',
              userName: user.displayName || user.email?.split('@')[0] || 'Anonymous'
            })
          });

          if (response.ok) {
            // Reset form
            (window as any).cancelReview(toiletId);
            alert('✅ Review submitted successfully!');
            // Refresh reviews display
            (window as any).loadReviews(toiletId);
          } else {
            const errorData = await response.json();
            if (response.status === 409) {
              alert('You have already reviewed this toilet. Each user can only submit one review per location.');
            } else {
              alert(`Failed to submit review: ${errorData.error || 'Please try again.'}`);
            }
          }
        } catch (error) {
          alert('Error submitting review. Please try again.');
        }
      };

      (window as any).cancelReview = (toiletId: string) => {
        const starsContainer = document.getElementById(`stars-${toiletId}`);
        const reviewForm = document.getElementById(`review-form-${toiletId}`);
        const reviewInput = document.getElementById(`review-input-${toiletId}`) as HTMLTextAreaElement;
        
        if (starsContainer && reviewForm && reviewInput) {
          // Reset stars
          const stars = starsContainer.querySelectorAll('button');
          stars.forEach(star => {
            (star as HTMLElement).style.color = '#cbd5e1';
          });
          
          // Hide form and reset input
          reviewForm.style.display = 'none';
          reviewInput.value = '';
          
          // Clear stored rating
          delete (window as any).currentRating;
        }
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
                      ${reviews.slice(0, 5).map(review => `
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
  }, [user, onLoginClick]);

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

    // Track when map moves away from user location and update marker position
    let updateTimeout: number;
    map.current.on('move', () => {
      if (!userLocation) return;
      
      const center = map.current.getCenter();
      const distance = getDistance(
        { lat: center.lat, lng: center.lng },
        userLocation
      );
      
      setIsAwayFromUser(distance > 50); // 50 meters threshold
    });



    // No map click handler - use only the + button for adding toilets

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [leafletLoaded, userLocation, user, onAddToiletClick]);

  // Update user location and center map
  useEffect(() => {
    if (!map.current || !userLocation || !leafletLoaded) {
      console.log('Map not ready or no user location:', { mapReady: !!map.current, userLocation, leafletLoaded });
      return;
    }

    console.log('Adding user location marker at:', userLocation);

    // Remove existing user markers
    if (userMarker.current) {
      map.current.removeLayer(userMarker.current);
    }
    if (userRingMarker.current) {
      map.current.removeLayer(userRingMarker.current);
    }

    // Create a blue user location marker (same as the red one that worked)
    userMarker.current = window.L.circleMarker([userLocation.lat, userLocation.lng], {
      radius: 10,
      fillColor: '#3b82f6',
      color: '#ffffff',
      weight: 3,
      opacity: 1,
      fillOpacity: 1,
      interactive: false,
      zIndexOffset: 1000
    }).addTo(map.current);

    // Add a pulsing outer ring using DivIcon with inline animation
    const pulseIcon = window.L.divIcon({
      className: 'pulse-ring-container',
      html: '<div style="width: 36px; height: 36px; border: 2px solid #3b82f6; border-radius: 50%; animation: pulse 1.5s infinite; opacity: 0.6;"></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    userRingMarker.current = window.L.marker([userLocation.lat, userLocation.lng], {
      icon: pulseIcon,
      interactive: false,
      zIndexOffset: 999
    }).addTo(map.current);

    console.log('User marker added to map');
    
    // Verify markers are actually on the map
    setTimeout(() => {
      if (map.current && userMarker.current) {
        const hasMarker = map.current.hasLayer(userMarker.current);
        const hasRing = map.current.hasLayer(userRingMarker.current);
        console.log('Marker verification:', { hasMarker, hasRing, markerLatLng: userMarker.current.getLatLng() });
        
        // Force map to redraw
        map.current.invalidateSize();
        
        // If markers aren't showing, try re-adding them
        if (!hasMarker) {
          console.log('Re-adding user marker');
          userMarker.current.addTo(map.current);
        }
        if (!hasRing) {
          console.log('Re-adding ring marker'); 
          userRingMarker.current.addTo(map.current);
        }
      }
    }, 200);

    // Center map on user location with 200m radius view
    map.current.setView([userLocation.lat, userLocation.lng], 16);
  }, [userLocation, leafletLoaded]);

  // Update toilet markers  
  useEffect(() => {
    if (!map.current || !window.L || !stableToilets.length) return;

    console.log('Map markers useEffect triggered, stableToilets count:', stableToilets.length);

    // Don't clear markers if we already have the same number - prevents disappearing
    if (markers.current.length === stableToilets.length) {
      console.log('Markers already match toilet count, skipping re-render');
      return;
    }

    // Only clear markers if we need to update them
    if (markers.current.length > 0) {
      markers.current.forEach(marker => {
        try {
          map.current.removeLayer(marker);
        } catch (e) {
          // Ignore errors if marker is already removed
        }
      });
      markers.current = [];
    }

    // Add toilet markers with Airbnb-style pins
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

      // Create enhanced popup content with all details
      const getLocationName = (toilet: any) => {
        const notes = toilet.notes || '';
        const type = toilet.type;
        
        // Try to extract a specific name from notes
        if (notes.toLowerCase().includes('shell')) return 'Toilet at Shell Gas Station';
        if (notes.toLowerCase().includes('lidl')) return 'Toilet in Lidl Store';
        if (notes.toLowerCase().includes('mall')) return 'Mall Restroom';
        if (notes.toLowerCase().includes('park')) return 'Park Public Toilet';
        if (notes.toLowerCase().includes('station')) return 'Train/Bus Station Toilet';
        if (notes.toLowerCase().includes('restaurant')) return 'Restaurant Restroom';
        if (notes.toLowerCase().includes('cafe')) return 'Cafe Restroom';
        
        // Fallback based on type
        switch (type) {
          case 'gas-station': return 'Gas Station Restroom';
          case 'restaurant': return 'Restaurant Restroom';
          case 'cafe': return 'Cafe Restroom';
          case 'mall': return 'Shopping Mall Restroom';
          case 'public': return 'Public Toilet';
          default: return 'Public Restroom';
        }
      };

      const getAvailabilityInfo = (toilet: any) => {
        const notes = toilet.notes || '';
        const type = toilet.type;
        
        // Check for specific availability info in notes
        if (notes.toLowerCase().includes('free')) return { text: 'Free to use', color: '#10b981' };
        if (notes.toLowerCase().includes('paid') || notes.toLowerCase().includes('fee')) return { text: 'Paid access', color: '#f59e0b' };
        if (notes.toLowerCase().includes('customer')) return { text: 'Customers only', color: '#ef4444' };
        if (notes.toLowerCase().includes('24')) return { text: 'Available 24/7', color: '#10b981' };
        
        // Default based on type
        switch (type) {
          case 'public': return { text: 'Public access', color: '#10b981' };
          case 'gas-station': return { text: 'Customers preferred', color: '#f59e0b' };
          case 'restaurant':
          case 'cafe': return { text: 'Customers only', color: '#ef4444' };
          case 'mall': return { text: 'Public during hours', color: '#10b981' };
          default: return { text: 'Access may vary', color: '#6b7280' };
        }
      };

      const getAccessibilityInfo = (toilet: any) => {
        const notes = toilet.notes || '';
        
        if (notes.toLowerCase().includes('wheelchair') || notes.toLowerCase().includes('accessible')) {
          return { text: 'Wheelchair accessible', icon: '♿', color: '#10b981' };
        }
        if (notes.toLowerCase().includes('stairs') || notes.toLowerCase().includes('step')) {
          return { text: 'May have stairs', icon: '⚠️', color: '#f59e0b' };
        }
        return { text: 'Accessibility unknown', icon: '❓', color: '#6b7280' };
      };

      const locationName = getLocationName(toilet);
      const availability = getAvailabilityInfo(toilet);
      const accessibility = getAccessibilityInfo(toilet);

      const popupContent = `
        <div style="min-width: 280px; max-width: 320px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; line-height: 1.4; padding: 16px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header with location name and rating -->
          <div style="
            padding-bottom: 16px;
            border-bottom: 1px solid #e5e7eb;
            margin-bottom: 18px;
          ">
            <div style="
              display: flex;
              align-items: flex-start;
              gap: 12px;
              margin-bottom: 8px;
            ">
              <div style="
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, #FF385C, #E31C5F);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                flex-shrink: 0;
                box-shadow: 0 2px 8px rgba(255, 56, 92, 0.3);
              ">🚽</div>
              <div style="flex: 1; min-width: 0;">
                <h3 style="
                  font-weight: 600;
                  font-size: 18px;
                  color: #111827;
                  margin: 0 0 4px 0;
                  line-height: 1.3;
                ">${locationName}</h3>
                ${toilet.averageRating && toilet.reviewCount > 0 ? `
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="display: flex; color: #FF385C; font-size: 14px;">
                      ${'★'.repeat(Math.round(toilet.averageRating))}${'☆'.repeat(5 - Math.round(toilet.averageRating))}
                    </div>
                    <span style="font-size: 13px; color: #6b7280;">
                      ${toilet.averageRating.toFixed(1)} (${toilet.reviewCount})
                    </span>
                  </div>
                ` : `
                  <div style="font-size: 13px; color: #9ca3af; font-style: italic;">
                    No reviews yet
                  </div>
                `}
              </div>
            </div>
          </div>
          
          <!-- Key information cards -->
          <div style="margin-bottom: 16px;">
            <!-- Availability -->
            <div style="
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 12px;
              background: #f9fafb;
              border-radius: 8px;
              margin-bottom: 8px;
              border-left: 4px solid ${availability.color};
            ">
              <div style="
                width: 32px;
                height: 32px;
                background: ${availability.color};
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                color: white;
                font-weight: bold;
              ">💳</div>
              <div>
                <div style="font-size: 13px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                  Availability
                </div>
                <div style="font-size: 15px; color: #111827; font-weight: 600;">
                  ${availability.text}
                </div>
              </div>
            </div>
            
            <!-- Accessibility -->
            <div style="
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 12px;
              background: #f9fafb;
              border-radius: 8px;
              border-left: 4px solid ${accessibility.color};
            ">
              <div style="
                width: 32px;
                height: 32px;
                background: ${accessibility.color};
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
              ">${accessibility.icon}</div>
              <div>
                <div style="font-size: 13px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                  Accessibility
                </div>
                <div style="font-size: 15px; color: #111827; font-weight: 600;">
                  ${accessibility.text}
                </div>
              </div>
            </div>
          </div>
          
          <!-- Description/Notes -->
          ${toilet.notes ? `
            <div style="
              padding: 12px;
              background: #f0f9ff;
              border-radius: 8px;
              border-left: 4px solid #0ea5e9;
              margin-bottom: 16px;
            ">
              <div style="font-size: 13px; color: #0369a1; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                Additional Info
              </div>
              <div style="font-size: 14px; color: #374151; line-height: 1.4;">
                ${toilet.notes}
              </div>
            </div>
          ` : ''}
          
          <!-- Quick rating section (only show if user is authenticated) -->
          ${user ? `
          <div id="rating-section-${toilet.id}" style="
            margin-bottom: 16px;
            padding: 12px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
          ">` : `
          <div style="
            margin-bottom: 16px;
            padding: 12px;
            background: #f0f9ff;
            border-radius: 8px;
            border: 1px solid #0ea5e9;
          ">
            <button onclick="window.openLoginModal()" style="
              width: 100%;
              padding: 16px;
              background: linear-gradient(135deg, #0ea5e9, #0284c7);
              color: white;
              border: none;
              border-radius: 12px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
              box-shadow: 0 4px 16px rgba(14, 165, 233, 0.3);
              min-height: 48px;
            " ontouchstart="this.style.transform='scale(0.98)'" ontouchend="this.style.transform='scale(1)'"
              🔐 Sign in to rate and review toilets
            </button>
          </div>
          <div style="display: none;">`}
            <div style="font-size: 13px; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
              Rate this toilet
            </div>
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div id="stars-${toilet.id}" style="display: flex; align-items: center; justify-content: space-between; width: 120px;">
                ${[1,2,3,4,5].map(rating => `
                  <button onclick="window.setRating('${toilet.id}', ${rating})" style="
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: #cbd5e1;
                    transition: all 0.2s ease;
                    padding: 4px;
                    width: 20px;
                    height: 28px;
                    border-radius: 4px;
                    line-height: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  " 
                  onmouseover="window.hoverStars('${toilet.id}', ${rating})" 
                  onmouseout="window.resetStars('${toilet.id}')"
                  ontouchstart="window.hoverStars('${toilet.id}', ${rating})" 
                  ontouchend="window.resetStars('${toilet.id}')">
                    ★
                  </button>
                `).join('')}
              </div>

            </div>
            <div id="review-form-${toilet.id}" style="display: none;">
              <textarea id="review-input-${toilet.id}" placeholder="Share your experience (optional)" style="
                width: 100%;
                min-height: 60px;
                padding: 8px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 14px;
                font-family: inherit;
                resize: vertical;
                margin-bottom: 8px;
              "></textarea>
              <div style="display: flex; gap: 8px;">
                <button onclick="window.submitReview('${toilet.id}')" style="
                  flex: 1;
                  padding: 8px 12px;
                  background: #10b981;
                  color: white;
                  border: none;
                  border-radius: 6px;
                  font-size: 14px;
                  font-weight: 500;
                  cursor: pointer;
                ">Submit Review</button>
                <button onclick="window.cancelReview('${toilet.id}')" style="
                  padding: 8px 12px;
                  background: #f3f4f6;
                  color: #6b7280;
                  border: none;
                  border-radius: 6px;
                  font-size: 14px;
                  cursor: pointer;
                ">Cancel</button>
              </div>
            </div>
          </div>
          ${user ? '' : '</div>'}

          <!-- Reviews Section -->
          <div id="reviews-${toilet.id}"></div>

          <!-- Action button -->
          <div style="padding-top: 4px;">
            <button onclick="window.getDirections(${toilet.coordinates.lat}, ${toilet.coordinates.lng})" style="
              width: 100%;
              padding: 14px 16px;
              background: linear-gradient(135deg, #FF385C, #E31C5F);
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 15px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
              box-shadow: 0 2px 4px rgba(255, 56, 92, 0.2);
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(255, 56, 92, 0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(255, 56, 92, 0.2)'">
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
          offset: [0, -40], // Offset to appear above the pin
          autoPan: true,
          keepInView: true,
          autoPanPadding: [20, 20]
        })
        .on('click', (e: any) => {
          e.originalEvent?.stopPropagation();
          marker.openPopup();
          // Load reviews when popup opens
          setTimeout(() => {
            (window as any).loadReviews(toilet.id);
          }, 100);
        });

      markers.current.push(marker);
    });
  }, [stableToilets]);

  const handleReturnToLocation = () => {
    if (userLocation && map.current) {
      map.current.setView([userLocation.lat, userLocation.lng], 16);
      setIsAwayFromUser(false);
    }
  };

  const handleAddToilet = () => {
    console.log('Add toilet button clicked, user:', !!user);
    
    if (!user) {
      // Show login prompt
      onLoginClick();
      return;
    }
    
    if (map.current) {
      const center = map.current.getCenter();
      console.log('Triggering add toilet at:', center.lat, center.lng);
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
      <div className="absolute top-6 right-6 space-y-3" style={{ zIndex: 1000 }}>
        {/* Return to Location Button - always show when user location available */}
        {userLocation && (
          <Button
            onClick={handleReturnToLocation}
            className="w-14 h-14 bg-white text-blue-600 hover:bg-gray-50 shadow-xl rounded-full p-0 border border-gray-200 transition-all duration-200 hover:scale-105 active:scale-95"
            variant="ghost"
            title="Return to my location"
          >
            <Crosshair className="w-6 h-6" />
          </Button>
        )}
      </div>

      {/* Floating Add Button */}
      <Button
        onClick={handleAddToilet}
        className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full shadow-xl p-0 transition-all duration-200 hover:scale-105 active:scale-95 border-2 border-white"
        style={{ zIndex: 1000 }}
        disabled={!user}
        title={!user ? "Sign in to add locations" : "Add toilet location"}
      >
        <Plus className="w-7 h-7" />
      </Button>
    </div>
  );
};

// Memoize the Map component to prevent re-renders when user state changes
export const Map = memo(MapComponent, (prevProps, nextProps) => {
  // Only re-render if the callback functions have changed
  return (
    prevProps.onToiletClick === nextProps.onToiletClick &&
    prevProps.onAddToiletClick === nextProps.onAddToiletClick &&
    prevProps.onLoginClick === nextProps.onLoginClick
  );
});

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