/**
 * TechKundi Service Worker v1.0
 * PWA Support: Offline, Caching, Fast Loading
 * Site: techkundi.blogspot.com
 * Author: Furqan Ahmad
 */

const CACHE_NAME = 'techkundi-v1.2';
const STATIC_CACHE = 'techkundi-static-v1';
const DYNAMIC_CACHE = 'techkundi-dynamic-v1';

// Files to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Sora:wght@400;600;700&display=swap'
];

// Install event - cache static assets
self.addEventListener('install', function(event) {
  console.log('[TechKundi SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) {
      console.log('[TechKundi SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).catch(function(err) {
      console.log('[TechKundi SW] Cache failed:', err);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', function(event) {
  console.log('[TechKundi SW] Activating...');
  event.waitUntil(
    caches.keys().then(function(keyList) {
      return Promise.all(
        keyList.filter(function(key) {
          return key !== STATIC_CACHE && key !== DYNAMIC_CACHE;
        }).map(function(key) {
          console.log('[TechKundi SW] Removing old cache:', key);
          return caches.delete(key);
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - cache-first for static, network-first for posts
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip Blogger admin/API requests
  if (url.includes('blogger.com/navbar') || url.includes('blogger.googleusercontent') ||
      url.includes('apis.google.com') || url.includes('accounts.google.com')) {
    return;
  }

  // Cache-first strategy for static assets (fonts, CSS, JS)
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com') ||
      url.includes('.css') || url.includes('.woff')) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request).then(function(response) {
          return caches.open(STATIC_CACHE).then(function(cache) {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // Network-first for HTML pages
  if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        return caches.open(DYNAMIC_CACHE).then(function(cache) {
          cache.put(event.request, response.clone());
          return response;
        });
      }).catch(function() {
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('/');
        });
      })
    );
    return;
  }

  // Cache-first for images
  if (url.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/)) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request).then(function(response) {
          return caches.open(DYNAMIC_CACHE).then(function(cache) {
            cache.put(event.request, response.clone());
            return response;
          });
        }).catch(function() {
          // Return placeholder for failed images
          return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225"><rect width="400" height="225" fill="#1c2333"/><text x="200" y="112" text-anchor="middle" fill="#8b949e" font-family="sans-serif" font-size="16">TechKundi</text></svg>',
            {headers: {'Content-Type': 'image/svg+xml'}});
        });
      })
    );
    return;
  }

  // Default: stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetchPromise = fetch(event.request).then(function(response) {
        caches.open(DYNAMIC_CACHE).then(function(cache) {
          cache.put(event.request, response.clone());
        });
        return response;
      });
      return cached || fetchPromise;
    })
  );
});

// Background sync for newsletter
self.addEventListener('sync', function(event) {
  if (event.tag === 'newsletter-sync') {
    event.waitUntil(syncNewsletter());
  }
});

function syncNewsletter() {
  // Handle offline newsletter subscriptions
  return Promise.resolve();
}

// Push notifications (future use)
self.addEventListener('push', function(event) {
  var data = event.data ? event.data.json() : {};
  var options = {
    body: data.body || 'New article from TechKundi!',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'read', title: 'Read Now' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'TechKundi Update', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'read' || !event.action) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
