// 📊 Performance Monitoring & Analytics

// 🔧 Web Vitals tracking
export const initPerformanceMonitoring = () => {
  // Only run in production or when explicitly enabled
  if (process.env.NODE_ENV === 'development' && !import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING) {
    return
  }

  // Dynamic import to reduce bundle size
  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    // 🎯 Core Web Vitals
    getCLS((metric) => {
      logMetric('CLS', metric.value, metric.rating)
    })

    getFID((metric) => {
      logMetric('FID', metric.value, metric.rating)
    })

    getFCP((metric) => {
      logMetric('FCP', metric.value, metric.rating)
    })

    getLCP((metric) => {
      logMetric('LCP', metric.value, metric.rating)
    })

    getTTFB((metric) => {
      logMetric('TTFB', metric.value, metric.rating)
    })
  }).catch((error) => {
    console.warn('Failed to load web-vitals:', error)
  })
}

// 📝 Log performance metrics
const logMetric = (name: string, value: number, rating: string) => {
  console.log(`🎯 ${name}: ${value.toFixed(2)}ms (${rating})`)
  
  // Send to analytics service in production
  if (process.env.NODE_ENV === 'production') {
    // You could send this to Google Analytics, Mixpanel, etc.
    sendToAnalytics(name, value, rating)
  }
}

// 📊 Send metrics to analytics service
const sendToAnalytics = (name: string, value: number, rating: string) => {
  // Placeholder for analytics integration
  // Example: Google Analytics 4
  if (typeof gtag !== 'undefined') {
    gtag('event', 'web_vital', {
      metric_name: name,
      metric_value: value,
      metric_rating: rating,
    })
  }
}

// ⏱️ Performance timing utilities
export const measurePerformance = (name: string) => {
  const start = performance.now()
  
  return {
    end: () => {
      const duration = performance.now() - start
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`)
      return duration
    }
  }
}

// 🎯 Mark important events
export const markEvent = (eventName: string) => {
  if ('mark' in performance) {
    performance.mark(eventName)
  }
}

// 📈 Measure between marks
export const measureBetween = (startMark: string, endMark: string, name: string) => {
  if ('measure' in performance) {
    try {
      performance.measure(name, startMark, endMark)
      const measure = performance.getEntriesByName(name)[0]
      console.log(`📈 ${name}: ${measure.duration.toFixed(2)}ms`)
      return measure.duration
    } catch (error) {
      console.warn(`Failed to measure ${name}:`, error)
    }
  }
  return 0
}

// 🧠 Memory usage monitoring
export const logMemoryUsage = () => {
  if ('memory' in performance) {
    const memory = (performance as any).memory
    console.log('🧠 Memory Usage:', {
      used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`,
    })
  }
}

// 🗺️ Map-specific performance tracking
export const mapPerformance = {
  markToiletRenderStart: () => markEvent('toilet-render-start'),
  markToiletRenderEnd: () => markEvent('toilet-render-end'),
  measureToiletRender: () => measureBetween('toilet-render-start', 'toilet-render-end', 'toilet-render'),
  
  markMapLoadStart: () => markEvent('map-load-start'),
  markMapLoadEnd: () => markEvent('map-load-end'),
  measureMapLoad: () => measureBetween('map-load-start', 'map-load-end', 'map-load'),
}

// 📱 Device & network information
export const getDeviceInfo = () => {
  const info = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as any).deviceMemory || 'unknown',
    connection: (navigator as any).connection ? {
      effectiveType: (navigator as any).connection.effectiveType,
      downlink: (navigator as any).connection.downlink,
      rtt: (navigator as any).connection.rtt,
      saveData: (navigator as any).connection.saveData,
    } : 'unknown',
    screenResolution: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
  }
  
  return info
}

// 🚀 Performance optimization recommendations
export const getPerformanceRecommendations = () => {
  const recommendations = []
  
  // Check device memory
  const deviceMemory = (navigator as any).deviceMemory
  if (deviceMemory && deviceMemory < 4) {
    recommendations.push('Consider reducing map markers for low-memory devices')
  }
  
  // Check connection
  const connection = (navigator as any).connection
  if (connection && connection.effectiveType === 'slow-2g') {
    recommendations.push('Enable data saving mode for slow connections')
  }
  
  // Check hardware concurrency
  if (navigator.hardwareConcurrency < 4) {
    recommendations.push('Reduce concurrent operations for low-end devices')
  }
  
  return recommendations
}

// 🎮 Usage tracking for features
class FeatureUsageTracker {
  private usageStats = new Map<string, number>()
  
  trackFeatureUsage(feature: string) {
    const current = this.usageStats.get(feature) || 0
    this.usageStats.set(feature, current + 1)
    
    console.log(`🎮 Feature used: ${feature} (${current + 1} times)`)
  }
  
  getUsageStats() {
    return Object.fromEntries(this.usageStats)
  }
  
  getMostUsedFeatures(limit = 5) {
    return Array.from(this.usageStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([feature, count]) => ({ feature, count }))
  }
}

export const featureTracker = new FeatureUsageTracker()

// 🔍 Error tracking
export const trackError = (error: Error, context?: Record<string, any>) => {
  console.error('🚨 Error tracked:', error, context)
  
  // Send to error tracking service in production
  if (process.env.NODE_ENV === 'production') {
    // Example: Sentry, LogRocket, etc.
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(error, { extra: context })
    }
  }
}

// 🧪 A/B testing framework (basic)
export const abTest = (testName: string, variants: string[]) => {
  const userId = localStorage.getItem('user-id') || 'anonymous'
  const hash = simpleHash(userId + testName)
  const variantIndex = hash % variants.length
  const selectedVariant = variants[variantIndex]
  
  console.log(`🧪 A/B Test "${testName}": ${selectedVariant}`)
  
  return selectedVariant
}

// Simple hash function for A/B testing
const simpleHash = (str: string): number => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

// 🏠 Initialize performance monitoring when this module is imported
if (typeof window !== 'undefined') {
  // Only in browser environment
  window.addEventListener('load', () => {
    initPerformanceMonitoring()
    
    // Log device info in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📱 Device Info:', getDeviceInfo())
      console.log('🚀 Performance Recommendations:', getPerformanceRecommendations())
    }
  })
  
  // Log memory usage periodically in development
  if (process.env.NODE_ENV === 'development') {
    setInterval(logMemoryUsage, 30000) // Every 30 seconds
  }
}