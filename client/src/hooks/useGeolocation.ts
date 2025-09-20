import { useState, useEffect, useRef } from "react";
import type { MapLocation } from "@/types/toilet";

interface GeolocationState {
  location: MapLocation | undefined;
  error: string | null;
  loading: boolean;
}

export const useGeolocation = () => {
  const [state, setState] = useState<GeolocationState>({
    location: undefined,
    error: null,
    loading: false
  });

  const watchIdRef = useRef<number | null>(null);
  const isWatchingRef = useRef(false);

  // Start continuous location tracking
  const startLocationTracking = () => {
    if (!navigator.geolocation || isWatchingRef.current) {
      return;
    }

    isWatchingRef.current = true;
    setState(prev => ({ ...prev, loading: true, error: null }));

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000 // Update every second for smooth movement
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        setState({
          location,
          error: null,
          loading: false
        });
      },
      (error) => {
        console.error("Location tracking error:", error.message);
        setState(prev => ({
          ...prev,
          error: "Location tracking failed",
          loading: false
        }));
        stopLocationTracking();
      },
      options
    );
  };

  // Stop continuous location tracking
  const stopLocationTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      isWatchingRef.current = false;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLocationTracking();
    };
  }, []);

  const getCurrentLocation = (forceNewPermission = false) => {

    if (!navigator.geolocation) {
      const errorMsg = "Geolocation is not supported by your browser";
      setState(prev => ({ ...prev, error: errorMsg }));
      console.error("❌ Geolocation not supported");
      return Promise.reject(new Error(errorMsg));
    }

    // Check if we're on HTTP (non-secure context) which might block geolocation
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      const errorMsg = "Geolocation requires HTTPS. Please use a secure connection.";
      setState(prev => ({ ...prev, error: errorMsg }));
      console.error("❌ Insecure context detected");
      return Promise.reject(new Error(errorMsg));
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    // If forcing new permission, try to reset the permission state
    if (forceNewPermission && 'permissions' in navigator) {
      // Note: We can't actually reset permissions, but we can check current state
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'denied') {
          console.warn("Location permission is denied. User needs to manually enable it.");
        }
      }).catch(() => {
        // Permission API not available
      });
    }
    
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const accuracy = position.coords.accuracy;
          
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          setState({
            location,
            error: null,
            loading: false
          });

          // Start continuous tracking after getting initial location
          startLocationTracking();
          
          resolve(location);
        },
        (error) => {
          console.error("Geolocation error:", error.message);
          
          let errorMessage = "Unable to get your location";
          let userInstructions = "";
          
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location access denied";
              userInstructions = "Please click the location icon in your address bar and allow location access, then try again.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable";
              userInstructions = "Please check your device's location settings and internet connection.";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out";
              userInstructions = "Please check your internet connection and try again.";
              break;
            default:
              errorMessage = `Location error (${error.code}): ${error.message}`;
          }
          
          const fullError = userInstructions ? `${errorMessage}. ${userInstructions}` : errorMessage;
          
          setState(prev => ({
            ...prev,
            error: fullError,
            loading: false
          }));
          
          reject(new Error(fullError));
        },
        {
          enableHighAccuracy: false, // Changed to false for better compatibility
          timeout: 20000, // Increased timeout to 20 seconds
          maximumAge: forceNewPermission ? 0 : 60000 // Force fresh location if new permission requested
        }
      );
    });
  };



  return {
    ...state,
    getCurrentLocation,
    startLocationTracking,
    stopLocationTracking
  };
};
