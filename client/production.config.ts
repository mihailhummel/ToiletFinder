// Production configuration for Toilet Map Bulgaria (toaletna.com)
// This file contains all production-specific settings

export const productionConfig = {
  // Domain and API configuration
  domain: 'https://toaletna.com',
  apiBaseUrl: 'https://toaletna.com/api',
  
  // Analytics
  googleAnalyticsId: 'G-FPF6DRB75R',
  enableAnalytics: true,
  
  // PWA settings
  pwaEnabled: true,
  appName: 'Toilet Map Bulgaria',
  appShortName: 'Toilet Map BG',
  
  // SEO settings
  siteName: 'Toilet Map Bulgaria',
  siteDescription: 'Интерактивна карта за намиране на обществени тоалетни в България. Безплатно, с отзиви и оценки. Специално за хора с ИЧС (IBS).',
  siteKeywords: 'тоалетна,обществена тоалетна,карта тоалетни,намери тоалетна,България,София,Пловдив,Варна,Бургас,ИЧС,IBS,toilet map,public restroom,Bulgaria',
  
  // Social media
  twitterHandle: '@toiletmapbg',
  facebookAppId: '',
  
  // Performance settings
  enablePerformanceMonitoring: true,
  enableSourceMaps: false,
  enableBundleAnalyzer: false,
  
  // Feature flags
  features: {
    offlineMode: true,
    pushNotifications: true,
    geolocation: true,
    clustering: true,
    realTimeUpdates: true
  },
  
  // Cache settings
  cache: {
    staticAssets: 31536000, // 1 year
    images: 2592000,        // 30 days
    apiResponses: 0,        // No cache
    htmlPages: 0,           // No cache (always fresh)
    serviceWorker: 0        // No cache
  },
  
  // Build settings
  build: {
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
    chunkSizeWarning: 800,
    minify: true,
    treeshake: true,
    cssCodeSplit: true
  },
  
  // Version and build info
  version: '2.0.0',
  buildDate: new Date().toISOString().split('T')[0] // YYYY-MM-DD
} as const

export type ProductionConfig = typeof productionConfig