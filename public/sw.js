// DeryCode AI Service Worker
const CACHE_NAME = 'derycode-ai-v16';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-256.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

// Install - cache static assets
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS).catch(function() {
        return Promise.all(STATIC_ASSETS.map(function(url) {
          return cache.add(url).catch(function() { return; });
        }));
      });
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches and take control
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(names.filter(function(n) {
        return n !== CACHE_NAME;
      }).map(function(n) {
        console.log('[SW] Deleting old cache:', n);
        return caches.delete(n);
      }));
    })
  );
  self.clients.claim();
});

// Fetch strategy:
// - API: network only (no cache)
// - Navigation (HTML pages): network first, fall back to cache
// - Static assets: cache first, fall back to network
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);

  // API requests - always network
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return new Response(JSON.stringify({error: 'You are offline. Please reconnect.'}), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Navigation requests (HTML pages) - network first, fall back to cache
  if (e.request.mode === 'navigate') {
    var requestUrl = new URL(e.request.url);
    
    // If this is an external link (has ?url= parameter), serve the app shell
    // and let the JavaScript handle the URL
    if (requestUrl.searchParams.has('url')) {
      e.respondWith(
        caches.match('/').then(function(cached) {
          return cached || fetch(e.request).then(function(response) {
            if (response.status === 200) {
              var clone = response.clone();
              caches.open(CACHE_NAME).then(function(cache) {
                cache.put(e.request, clone);
              });
            }
            return response;
          }).catch(function() {
            return caches.match('/');
          });
        })
      );
      return;
    }
    
    // Normal navigation - cache and serve
    e.respondWith(
      fetch(e.request).then(function(response) {
        if (response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return caches.match(e.request).then(function(cached) {
          return cached || caches.match('/');
        });
      })
    );
    return;
  }

  // Static assets - cache first, fall back to network
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      
      return fetch(e.request).then(function(response) {
        if (response.status === 200 && url.origin === location.origin) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return new Response('', { status: 404 });
      });
    })
  );
});
