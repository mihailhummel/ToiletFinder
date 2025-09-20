import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from '../hooks/useGeolocation';

// Mock the geolocation API
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
};

Object.defineProperty(navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
});

describe('useGeolocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful geolocation response
    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: 42.6977,
          longitude: 23.3219,
          accuracy: 10
        }
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start location tracking after getting initial location', async () => {
    const { result } = renderHook(() => useGeolocation());

    // Mock watchPosition to track calls
    mockGeolocation.watchPosition.mockImplementation((success) => {
      // Simulate location updates
      setTimeout(() => {
        success({
          coords: {
            latitude: 42.6978,
            longitude: 23.3220,
            accuracy: 10
          }
        });
      }, 100);
      return 1; // Mock watch ID
    });

    // Get initial location
    await act(async () => {
      await result.current.getCurrentLocation();
    });

    // Verify watchPosition was called
    expect(mockGeolocation.watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      })
    );

    // Verify initial location is set
    expect(result.current.location).toEqual({
      lat: 42.6977,
      lng: 23.3219
    });
  });

  it('should handle location tracking errors', async () => {
    const { result } = renderHook(() => useGeolocation());

    // Mock watchPosition to call error callback
    mockGeolocation.watchPosition.mockImplementation((success, error) => {
      error({
        code: 1,
        message: 'Permission denied'
      });
      return 1;
    });

    // Get initial location first
    await act(async () => {
      await result.current.getCurrentLocation();
    });

    // Wait for watchPosition to be called and error to be handled
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify error is handled
    expect(result.current.error).toBe('Location tracking failed');
  });

  it('should stop location tracking on cleanup', () => {
    const { result, unmount } = renderHook(() => useGeolocation());

    // Mock watchPosition to return a watch ID
    mockGeolocation.watchPosition.mockReturnValue(1);

    // Start tracking
    act(() => {
      result.current.startLocationTracking();
    });

    // Unmount component
    unmount();

    // Verify clearWatch was called
    expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(1);
  });
});
