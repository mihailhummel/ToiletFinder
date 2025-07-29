// Haptics utility for mobile devices
export const haptics = {
  // Light haptic feedback for button taps
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },

  // Medium haptic feedback for important actions
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  },

  // Strong haptic feedback for critical actions
  strong: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  },

  // Success haptic pattern
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([10, 50, 10]);
    }
  },

  // Error haptic pattern
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([20, 50, 20, 50, 20]);
    }
  },

  // Warning haptic pattern
  warning: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([15, 30, 15]);
    }
  }
}; 