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

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, error: "Geolocation is not supported by your browser" }));
      console.error("Geolocation not supported");
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    console.log("Requesting user location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const accuracy = position.coords.accuracy;
        console.log(`📍 Location obtained: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)} (accuracy: ${accuracy}m)`);
        
        setState({
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          },
          error: null,
          loading: false
        });
      },
      (error) => {
        console.error("🚫 Geolocation error:", error);
        let errorMessage = "Unable to get your location";
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied. Please enable location permission for this site.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable. Please check your device's location settings.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please check your internet connection and try again.";
            break;
        }
        
        setState(prev => ({
          ...prev,
          error: errorMessage,
          loading: false
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, // Increased timeout to 15 seconds
        maximumAge: 30000 // Reduced cache to 30 seconds for better accuracy
      }
    );
  };



  return {
    ...state,
    getCurrentLocation
  };
};
