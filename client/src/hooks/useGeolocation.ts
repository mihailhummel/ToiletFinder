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
      setState(prev => ({ ...prev, error: "Geolocation is not supported" }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
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
        setState(prev => ({
          ...prev,
          error: error.message,
          loading: false
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  return {
    ...state,
    getCurrentLocation
  };
};
