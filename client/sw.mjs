// sw.mjs (Service Worker)
// Module-based Service Worker for caching API GET requests and queueing POSTs

const CACHENAME = 'api-cache-v1';
const POSTQUEUE = 'post-queue';

/**
 * Open or create IndexedDB database for queuing POST requests
 * @returns {Promise<IDBDatabase>}
 */
function openDb() {
  // No await inside; returns a Promise directly
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sw-db', 1);

    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(POSTQUEUE)) {
        db.createObjectStore(POSTQUEUE, { autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Queue failed POST requests in IndexedDB
 * @param {Request} request
 * @returns {Promise<void>}
 */
async function queuePost(request) {
  const { url, headers } = request.clone();
  const body = await request.clone().json();
  const db = await openDb();
  const tx = db.transaction(POSTQUEUE, 'readwrite');
  const store = tx.objectStore(POSTQUEUE);
  store.add({ url, body, headers: Array.from(headers.entries()) });
  return tx.complete;
}

/**
 * Replay queued POST requests when back online or on sync event
 * @returns {Promise<void>}
 */
async function replayQueue() {
  const db = await openDb();
  const tx = db.transaction(POSTQUEUE, 'readwrite');
  const store = tx.objectStore(POSTQUEUE);
  const allKeys = await store.getAllKeys();

  await Promise.all(
    allKeys.map(async key => {
      const entry = await store.get(key);
      await fetch(entry.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...Object.fromEntries(entry.headers) },
        body: JSON.stringify(entry.body),
      });
      store.delete(key);
    }),
  );

  return tx.complete;
}

// Install: activate immediately
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

// Activate: clean up old caches and take control of clients
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys =>
        Promise.all(
          keys.filter(key => key !== CACHENAME).map(key => caches.delete(key)),
        ),
      ),
    ]),
  );
});

// Fetch: handle GET and POST for API endpoints
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  const isApi = url.origin === self.location.origin &&
                request.headers.get('accept')?.includes('application/json');

  if (isApi && request.method === 'GET') {
    // Network-first, then cache fallback
    event.respondWith(
      caches.open(CACHENAME).then(cache =>
        fetch(request)
          .then(response => {
            cache.put(request, response.clone());
            return response;
          })
          .catch(() => cache.match(request)),
      ),
    );
    return;
  }

  if (isApi && request.method === 'POST') {
    event.respondWith(
      fetch(request.clone())
        .catch(async () => {
          await queuePost(request);
          await self.registration.sync.register('sync-post-requests');
          return new Response(JSON.stringify({ queued: true }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
          });
        }),
    );
  }
});

// Background sync: replay queued posts
self.addEventListener('sync', event => {
  if (event.tag === 'sync-post-requests') {
    event.waitUntil(replayQueue());
  }
});

// Periodic sync fallback
self.addEventListener('periodicsync', event => {
  if (event.tag === 'post-sync') {
    event.waitUntil(replayQueue());
  }
});
