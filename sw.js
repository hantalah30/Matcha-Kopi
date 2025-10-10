const STATIC_CACHE_NAME = "kopimatcha-static-v3";
const DYNAMIC_CACHE_NAME = "kopimatcha-dynamic-v3";

// Daftar aset inti yang membentuk App Shell
const APP_SHELL_ASSETS = [
  "./",
  "./index.html",
  "./checkout.html",
  "./login.html",
  "./admin.html",
  "./offline.html",
  "./assets/css/styles.css",
  "./assets/css/admin.css",
  "./assets/css/checkout.css",
  "./assets/js/main.js",
  "./assets/js/admin.js",
  "./assets/js/checkout.js",
  "./assets/js/firebase-config.js",
  "./assets/img/favicon.png",
  "./assets/img/home-coffee.png",
  "./preview.png",
  "https://cdnjs.cloudflare.com/ajax/libs/remixicon/4.6.0/remixicon.min.css",
];

// 1. Install Service Worker & Pre-cache App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log("Service Worker: Pre-caching App Shell...");
      return cache.addAll(APP_SHELL_ASSETS);
    })
  );
});

// 2. Aktifkan Service Worker & Hapus Cache Lama
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME) {
            console.log("Service Worker: Menghapus cache lama:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 3. Intercept Fetch Requests (Stale-While-Revalidate Strategy)
self.addEventListener("fetch", (event) => {
  // Hanya proses request GET
  if (event.request.method !== "GET") {
    return;
  }

  // Strategi untuk Firebase & URL Eksternal (Network First)
  if (
    event.request.url.includes("firebase") ||
    event.request.url.includes("firestore.googleapis.com")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Strategi Stale-While-Revalidate untuk aset yang ada di cache
  if (
    APP_SHELL_ASSETS.some((asset) =>
      event.request.url.endsWith(asset.substring(1))
    )
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
          return response || fetchPromise; // Kembalikan dari cache, atau dari network jika tidak ada
        });
      })
    );
  } else {
    // Strategi Cache-First dengan fallback ke network untuk aset dinamis (gambar produk, dll)
    event.respondWith(
      caches
        .match(event.request)
        .then((response) => {
          return (
            response ||
            fetch(event.request).then((networkResponse) => {
              return caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
              });
            })
          );
        })
        .catch(() => {
          // Jika semua gagal (offline dan tidak ada di cache), tampilkan halaman offline
          if (event.request.mode === "navigate") {
            return caches.match("./offline.html");
          }
        })
    );
  }
});
