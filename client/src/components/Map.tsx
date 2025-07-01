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

// Declare Leaflet types for global window object
declare global {
  interface Window {
    L: any;
    getDirections: (lat: number, lng: number) => void;
    setRating: (toiletId: string, rating: number) => void;
    submitReview: (toiletId: string) => void;
    cancelReview: (toiletId: string) => void;
    currentRating?: { toiletId: string; rating: number };
  }
}

export const Map = ({ onToiletClick, onAddToiletClick }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const userMarker = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [isAwayFromUser, setIsAwayFromUser] = useState(false);
  
  const { location: userLocation, loading: locationLoading } = useGeolocation();
  const { user } = useAuth();
  
  // Use nearby toilets within 100m when user location is available
  const { data: toilets = [] } = useToilets(userLocation);

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

      (window as any).setRating = (toiletId: string, rating: number) => {
        // Update star display
        const starsContainer = document.getElementById(`stars-${toiletId}`);
        const ratingText = document.getElementById(`rating-text-${toiletId}`);
        const reviewForm = document.getElementById(`review-form-${toiletId}`);
        
        if (starsContainer && ratingText && reviewForm) {
          // Update stars visual
          const stars = starsContainer.querySelectorAll('button');
          stars.forEach((star, index) => {
            if (index < rating) {
              star.style.color = '#FF385C';
            } else {
              star.style.color = '#cbd5e1';
            }
          });
          
          // Update text and show review form
          ratingText.textContent = `${rating} star${rating !== 1 ? 's' : ''} selected`;
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
              comment: reviewInput.value.trim() || null,
              userId: user.uid || user.email || 'anonymous'
            })
          });

          if (response.ok) {
            // Reset form
            (window as any).cancelReview(toiletId);
            alert('Review submitted successfully!');
            // Trigger a refetch of toilets data
            window.location.reload();
          } else {
            alert('Failed to submit review. Please try again.');
          }
        } catch (error) {
          alert('Error submitting review. Please try again.');
        }
      };

      (window as any).cancelReview = (toiletId: string) => {
        const starsContainer = document.getElementById(`stars-${toiletId}`);
        const ratingText = document.getElementById(`rating-text-${toiletId}`);
        const reviewForm = document.getElementById(`review-form-${toiletId}`);
        const reviewInput = document.getElementById(`review-input-${toiletId}`) as HTMLTextAreaElement;
        
        if (starsContainer && ratingText && reviewForm && reviewInput) {
          // Reset stars
          const stars = starsContainer.querySelectorAll('button');
          stars.forEach(star => {
            (star as HTMLElement).style.color = '#cbd5e1';
          });
          
          // Reset text and hide form
          ratingText.textContent = 'Tap to rate';
          reviewForm.style.display = 'none';
          reviewInput.value = '';
          
          // Clear stored rating
          delete (window as any).currentRating;
        }
      };
    }
  }, [user]);

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

    // Add click handler for adding toilets (only if user is authenticated)
    map.current.on('click', (e: any) => {
      // Don't trigger if clicking on a marker
      if (e.originalEvent.target.closest('.toilet-marker')) {
        return;
      }
      
      if (user) { // Only allow if authenticated
        const { lat, lng } = e.latlng;
        onAddToiletClick({ lat, lng });
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [leafletLoaded, userLocation, user, onAddToiletClick]);

  // Update user location and center map
  useEffect(() => {
    if (!map.current || !userLocation) return;

    // Remove existing user marker
    if (userMarker.current) {
      map.current.removeLayer(userMarker.current);
    }

    // Create modern user location marker with pulsing effect
    const userIcon = window.L.divIcon({
      className: 'user-location-marker',
      html: `
        <div style="
          position: relative;
          width: 20px;
          height: 20px;
        ">
          <div style="
            position: absolute;
            width: 20px;
            height: 20px;
            background: #3b82f6;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
            animation: pulse 2s infinite;
          "></div>
        </div>
        <style>
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
            100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
          }
        </style>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    userMarker.current = window.L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
      .addTo(map.current);

    // Center map on user location with high zoom
    map.current.setView([userLocation.lat, userLocation.lng], 16);
  }, [userLocation]);

  // Update toilet markers
  useEffect(() => {
    if (!map.current || !window.L) return;

    // Clear existing markers
    markers.current.forEach(marker => {
      try {
        map.current.removeLayer(marker);
      } catch (e) {
        // Ignore errors if marker is already removed
      }
    });
    markers.current = [];

    // Add toilet markers with Airbnb-style pins
    toilets.forEach(toilet => {
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
        <div style="min-width: 280px; max-width: 340px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; line-height: 1.4; padding: 20px;">
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
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="display: flex; color: #FF385C;">
                      ${'★'.repeat(Math.round(toilet.averageRating))}${'☆'.repeat(5 - Math.round(toilet.averageRating))}
                    </div>
                    <span style="font-size: 14px; color: #6b7280; font-weight: 500;">
                      ${toilet.averageRating.toFixed(1)} (${toilet.reviewCount} review${toilet.reviewCount !== 1 ? 's' : ''})
                    </span>
                  </div>
                ` : `
                  <div style="font-size: 14px; color: #9ca3af; font-style: italic;">
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
            <div style="font-size: 14px; color: #0369a1; text-align: center;">
              <strong>Sign in to rate and review toilets</strong>
            </div>
          </div>
          <div style="display: none;">`}
            <div style="font-size: 13px; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
              Rate this toilet
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <div id="stars-${toilet.id}" style="display: flex; gap: 2px;">
                ${[1,2,3,4,5].map(rating => `
                  <button onclick="window.setRating('${toilet.id}', ${rating})" style="
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: #cbd5e1;
                    transition: color 0.2s;
                  " onmouseover="this.style.color='#FF385C'" onmouseout="this.style.color='#cbd5e1'">
                    ★
                  </button>
                `).join('')}
              </div>
              <span id="rating-text-${toilet.id}" style="font-size: 14px; color: #64748b;">
                Tap to rate
              </span>
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
        });

      markers.current.push(marker);
    });
  }, [toilets]);

  const handleReturnToLocation = () => {
    if (userLocation && map.current) {
      map.current.setView([userLocation.lat, userLocation.lng], 16);
      setIsAwayFromUser(false);
    }
  };

  const handleAddToilet = () => {
    if (!user) {
      // Show login prompt or trigger authentication
      return;
    }
    
    if (map.current) {
      const center = map.current.getCenter();
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
      <div className="absolute top-4 right-4 space-y-2 z-50">
        {/* Return to Location Button - only show when away from user */}
        {isAwayFromUser && userLocation && (
          <Button
            onClick={handleReturnToLocation}
            className="w-12 h-12 bg-white text-blue-600 hover:bg-gray-50 shadow-lg rounded-full p-0 border border-gray-200"
            variant="ghost"
          >
            <Crosshair className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Floating Add Button */}
      <Button
        onClick={handleAddToilet}
        className="fixed bottom-6 right-6 w-14 h-14 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg p-0 z-50"
        disabled={!user}
        title={!user ? "Sign in to add locations" : "Add toilet location"}
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  );
};

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