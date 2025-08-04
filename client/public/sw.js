// 🚀 Service Worker for Offline Support & Caching

const CACHE_NAME = 'toilet-finder-v1'
const STATIC_CACHE = 'toilet-finder-static-v1'
const API_CACHE = 'toilet-finder-api-v1'

// 📦 Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html', // Fallback page
]

// 🎯 API endpoints to cache
const API_ENDPOINTS = [
  '/api/toilets',
  '/api/health',
]

// 📱 Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker installing...')
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('📦 Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      }),
      
      // Cache API endpoints
      caches.open(API_CACHE).then((cache) => {
        console.log('📦 Pre-caching API endpoints')
        return cache.addAll(API_ENDPOINTS)
      })
    ]).then(() => {
      console.log('✅ Service Worker installed successfully')
      // Take control immediately
      return self.skipWaiting()
    })
  )
})

// 🔄 Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker activating...')
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches
          if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
            console.log('🗑️ Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => {
      console.log('✅ Service Worker activated')
      // Take control of all clients
      return self.clients.claim()
    })
  )
})

// 🌐 Fetch event - intercept network requests
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }
  
  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    // API requests - Network First strategy
    event.respondWith(handleAPIRequest(request))
  } else if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/)) {
    // Static assets - Cache First strategy
    event.respondWith(handleStaticAssets(request))
  } else {
    // HTML pages - Network First with fallback
    event.respondWith(handlePageRequest(request))
  }
})

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
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Toilet Finder - Offline</title>
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
        <h1>You're Offline</h1>
        <p>The toilet finder is not available right now. Please check your internet connection and try again.</p>
        <button onclick="window.location.reload()">Try Again</button>
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
    body: 'New toilets have been added in your area!',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'toilet-update',
    renotify: true,
    actions: [
      {
        action: 'view',
        title: 'View Map'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  }
  
  event.waitUntil(
    self.registration.showNotification('Toilet Finder', options)
  )
})

// 🔔 Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.action)
  
  event.notification.close()
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    )
  }
})

console.log('🚀 Service Worker loaded successfully')