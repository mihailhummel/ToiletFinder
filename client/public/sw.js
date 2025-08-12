// 🚀 Production Service Worker for Toilet Map Bulgaria (toaletna.com)
// Optimized for performance, SEO, and offline functionality

const VERSION = '2.0.0'
const CACHE_NAME = `toilet-map-v${VERSION}`
const STATIC_CACHE = `toilet-map-static-v${VERSION}`
const API_CACHE = `toilet-map-api-v${VERSION}`
const IMAGE_CACHE = `toilet-map-images-v${VERSION}`

// 📊 Performance monitoring
const PERFORMANCE_MARKS = {
  SW_INSTALL_START: 'sw-install-start',
  SW_INSTALL_END: 'sw-install-end',
  SW_ACTIVATE_START: 'sw-activate-start',
  SW_ACTIVATE_END: 'sw-activate-end'
}

// 📦 Critical assets to cache on install (production optimized)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/icon-192x192.png',
  '/icon-512x512.png'
]

// 🖼️ Image assets for lazy caching
const IMAGE_PATTERNS = [
  /\.(png|jpg|jpeg|svg|webp|gif|ico)$/i,
  /\/icon-/,
  /\/og-image\./,
  /\/screenshot-/
]

// 🎯 API endpoints to cache
const API_ENDPOINTS = [
  '/api/toilets',
  '/api/health',
]

// 📱 Install event - optimized caching strategy
self.addEventListener('install', (event) => {
  performance.mark(PERFORMANCE_MARKS.SW_INSTALL_START)
  console.log(`📦 Toilet Map SW v${VERSION} installing...`)
  
  event.waitUntil(
    Promise.all([
      // Cache critical static assets only
      caches.open(STATIC_CACHE).then(async (cache) => {
        console.log('📦 Caching critical static assets')
        try {
          await cache.addAll(STATIC_ASSETS.filter(asset => {
            // Only cache assets that exist
            return !asset.includes('offline.html') // We'll create this dynamically
          }))
          console.log('✅ Static assets cached successfully')
        } catch (error) {
          console.warn('⚠️ Some static assets failed to cache:', error)
          // Cache individual assets that work
          const promises = STATIC_ASSETS.map(async (asset) => {
            try {
              await cache.add(asset)
            } catch (e) {
              console.warn(`Failed to cache ${asset}:`, e)
            }
          })
          await Promise.allSettled(promises)
        }
      }),
      
      // Pre-warm API cache (don't fail install if this fails)
      caches.open(API_CACHE).then(async (cache) => {
        console.log('📦 Pre-warming API cache')
        try {
          // Only cache health endpoint for availability check
          await fetch('/api/health').then(response => {
            if (response.ok) {
              cache.put('/api/health', response.clone())
            }
          })
        } catch (error) {
          console.log('ℹ️ API pre-warming skipped (offline install)')
        }
      })
    ]).then(() => {
      performance.mark(PERFORMANCE_MARKS.SW_INSTALL_END)
      console.log('✅ Toilet Map SW installed successfully')
      
      // Measure performance
      if (performance.measure) {
        const measure = performance.measure('sw-install-duration', 
          PERFORMANCE_MARKS.SW_INSTALL_START, 
          PERFORMANCE_MARKS.SW_INSTALL_END
        )
        console.log(`📊 SW install took ${measure.duration.toFixed(2)}ms`)
      }
      
      // Take control immediately for better UX
      return self.skipWaiting()
    }).catch(error => {
      console.error('❌ SW install failed:', error)
      // Still skip waiting to avoid broken state
      return self.skipWaiting()
    })
  )
})

// 🔄 Activate event - optimized cache cleanup
self.addEventListener('activate', (event) => {
  performance.mark(PERFORMANCE_MARKS.SW_ACTIVATE_START)
  console.log(`🔄 Toilet Map SW v${VERSION} activating...`)
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        const currentCaches = [STATIC_CACHE, API_CACHE, IMAGE_CACHE]
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log('🗑️ Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      }),
      
      // Notify clients about update
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: VERSION,
            timestamp: Date.now()
          })
        })
      })
    ]).then(() => {
      performance.mark(PERFORMANCE_MARKS.SW_ACTIVATE_END)
      console.log('✅ Toilet Map SW activated successfully')
      
      // Measure performance
      if (performance.measure) {
        const measure = performance.measure('sw-activate-duration',
          PERFORMANCE_MARKS.SW_ACTIVATE_START,
          PERFORMANCE_MARKS.SW_ACTIVATE_END
        )
        console.log(`📊 SW activate took ${measure.duration.toFixed(2)}ms`)
      }
      
      // Take control of all clients
      return self.clients.claim()
    })
  )
})

// Fetch event moved to bottom with image handling

// 🔌 Network First strategy for API requests
async function handleAPIRequest(request) {
  const cache = await caches.open(API_CACHE)
  
  try {
    // Try network first
    console.log('🌐 Fetching from network:', request.url)
    const networkResponse = await fetch(request)
    
    // Cache successful responses
    if (networkResponse.ok) {
      console.log('💾 Caching API response:', request.url)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    // Network failed - try cache
    console.log('📡 Network failed, trying cache:', request.url)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      console.log('💾 Serving from cache:', request.url)
      return cachedResponse
    }
    
    // No cache - return offline response
    return createOfflineResponse(request.url)
  }
}

// 🎨 Cache First strategy for static assets
async function handleStaticAssets(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cachedResponse = await cache.match(request)
  
  if (cachedResponse) {
    console.log('💾 Serving static asset from cache:', request.url)
    return cachedResponse
  }
  
  try {
    console.log('🌐 Fetching static asset from network:', request.url)
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('❌ Failed to fetch static asset:', request.url)
    return new Response('Asset not available offline', { status: 503 })
  }
}

// 📄 Network First for page requests
async function handlePageRequest(request) {
  try {
    console.log('🌐 Fetching page from network:', request.url)
    const networkResponse = await fetch(request)
    
    // Cache successful page responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    // Network failed - try cache
    console.log('📡 Network failed for page, trying cache:', request.url)
    const cache = await caches.open(STATIC_CACHE)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Fallback to offline page
    return cache.match('/offline.html') || new Response(
      createOfflineHTML(),
      { headers: { 'Content-Type': 'text/html' } }
    )
  }
}

// 🚫 Create offline response
function createOfflineResponse(url) {
  if (url.includes('/api/toilets')) {
    // Return empty array for toilet API
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })
  }
  
  return new Response(JSON.stringify({
    error: 'Offline',
    message: 'This feature is not available offline'
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 503
  })
}

// 📱 Create offline HTML page
function createOfflineHTML() {
  return `
    <!DOCTYPE html>
    <html lang="bg">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Toilet Map Bulgaria - Офлайн</title>
      <meta name="description" content="Toilet Map Bulgaria не е достъпна в момента. Моля, проверете интернет връзката си.">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 20px;
          background: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          text-align: center;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          max-width: 400px;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          color: #333;
          margin-bottom: 10px;
        }
        p {
          color: #666;
          line-height: 1.5;
          margin-bottom: 20px;
        }
        button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
        }
        button:hover {
          background: #2563eb;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">🚽</div>
        <h1>Офлайн сте</h1>
        <p>Toilet Map Bulgaria не е достъпна в момента. Моля, проверете интернет връзката си и опитайте отново.</p>
        <button onclick="window.location.reload()">Опитайте отново</button>
        <br><br>
        <small style="color: #999; font-size: 12px;">toaletna.com</small>
      </div>
    </body>
    </html>
  `
}

// 💾 Background sync for pending actions
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag)
  
  if (event.tag === 'toilet-sync') {
    event.waitUntil(syncPendingToilets())
  }
})

// 🚽 Sync pending toilet additions
async function syncPendingToilets() {
  console.log('🚽 Syncing pending toilets...')
  
  try {
    // Get pending toilets from IndexedDB (implementation needed)
    const pendingToilets = await getPendingToilets()
    
    for (const toilet of pendingToilets) {
      try {
        const response = await fetch('/api/toilets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(toilet.data)
        })
        
        if (response.ok) {
          console.log('✅ Synced toilet:', toilet.id)
          await removePendingToilet(toilet.id)
        }
      } catch (error) {
        console.error('❌ Failed to sync toilet:', toilet.id, error)
      }
    }
  } catch (error) {
    console.error('❌ Background sync failed:', error)
  }
}

// 📦 Placeholder functions for IndexedDB operations
async function getPendingToilets() {
  // TODO: Implement IndexedDB storage for offline data
  return []
}

async function removePendingToilet(id) {
  // TODO: Implement IndexedDB removal
  console.log('🗑️ Remove pending toilet:', id)
}

// 📱 Push notification handler
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received')
  
  const options = {
    body: 'Нови тоалетни са добавени във вашия район!',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: 'toilet-update',
    data: { url: '/?utm_source=push_notification' },
    renotify: true,
    actions: [
      {
        action: 'view',
        title: 'Вижте картата',
        icon: '/icon-72x72.png'
      },
      {
        action: 'dismiss',
        title: 'Затвори'
      }
    ]
  }
  
  event.waitUntil(
    self.registration.showNotification('Toilet Map Bulgaria', options)
  )
})

// 🔔 Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.action)
  
  event.notification.close()
  
  if (event.action === 'view') {
    const urlToOpen = event.notification.data?.url || '/?utm_source=push_notification'
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(windowClients => {
          // Check if app is already open
          for (let client of windowClients) {
            if (client.url.includes('toaletna.com') && 'focus' in client) {
              return client.focus()
            }
          }
          // Open new window if not open
          return clients.openWindow(urlToOpen)
        })
    )
  }
})

// 📱 Handle image caching with separate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }
  
  // Handle images separately for better performance
  if (IMAGE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(handleImageRequest(request))
    return
  }
  
  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    // API requests - Network First strategy
    event.respondWith(handleAPIRequest(request))
  } else if (url.pathname.match(/\.(js|css|woff|woff2)$/)) {
    // Static assets - Cache First strategy
    event.respondWith(handleStaticAssets(request))
  } else {
    // HTML pages - Network First with fallback
    event.respondWith(handlePageRequest(request))
  }
})

// 🖼️ Optimized image handling
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE)
  const cachedResponse = await cache.match(request)
  
  if (cachedResponse) {
    return cachedResponse
  }
  
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      // Only cache images under 1MB
      const contentLength = networkResponse.headers.get('content-length')
      if (!contentLength || parseInt(contentLength) < 1024 * 1024) {
        cache.put(request, networkResponse.clone())
      }
    }
    return networkResponse
  } catch (error) {
    // Return a fallback image or empty response
    return new Response('', { status: 503, statusText: 'Image unavailable offline' })
  }
}

// 📊 Analytics integration
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ANALYTICS_EVENT') {
    // Forward analytics events when online
    if (navigator.onLine) {
      // Implementation would depend on your analytics setup
      console.log('📊 Analytics event:', event.data)
    }
  }
})

console.log(`🚀 Toilet Map Bulgaria SW v${VERSION} loaded successfully - toaletna.com`)