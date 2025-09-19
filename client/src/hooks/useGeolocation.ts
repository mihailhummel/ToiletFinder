import { useState, useEffect } from "react";
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

  const getCurrentLocation = (forceNewPermission = false) => {
    console.log("🌍 Starting location request...");
    console.log("🔍 Browser info:", {
      isSecureContext: window.isSecureContext,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      userAgent: navigator.userAgent.substring(0, 100)
    });

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
      console.log("🔄 Attempting to reset location permission...");
      // Note: We can't actually reset permissions, but we can check current state
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        console.log("📍 Current permission state:", result.state);
        if (result.state === 'denied') {
          console.log("❌ Location permission is denied. User needs to manually enable it.");
        }
      }).catch(err => {
        console.log("⚠️ Permission API not available:", err);
      });
    }
    
    return new Promise((resolve, reject) => {
      console.log("📍 Calling navigator.geolocation.getCurrentPosition...");
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const accuracy = position.coords.accuracy;
          console.log("✅ Location obtained successfully:", {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: accuracy
          });
          
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          setState({
            location,
            error: null,
            loading: false
          });
          
          resolve(location);
        },
        (error) => {
          console.error("🚫 Geolocation error details:", {
            code: error.code,
            message: error.message,
            PERMISSION_DENIED: error.PERMISSION_DENIED,
            POSITION_UNAVAILABLE: error.POSITION_UNAVAILABLE,
            TIMEOUT: error.TIMEOUT
          });
          
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
    getCurrentLocation
  };
};
