// Naikkan versinya setiap kali ada update besar, misal v4 -> v5
const STATIC_CACHE_NAME = "kopimatcha-static-v5";
const DYNAMIC_CACHE_NAME = "kopimatcha-dynamic-v5";

// Daftar aset inti yang membentuk App Shell
// PASTIKAN DAFTAR INI LENGKAP DAN SESUAI FILE ANDA
const APP_SHELL_ASSETS = [
  "./", // Root (index.html)
  "./index.html",
  "./checkout.html",
  "./login.html",
  "./admin.html",
  "./thankyou.html", // Tambahkan jika perlu di-cache
  "./offline.html",
  "./assets/css/styles.css",
  "./assets/css/admin.css",
  "./assets/css/checkout.css",
  "./assets/css/thankyou.css", // Tambahkan
  "./assets/js/main.js",
  "./assets/js/admin.js",
  "./assets/js/checkout.js",
  "./assets/js/review.js", // Tambahkan
  "./assets/js/firebase-config.js",
  "./assets/img/favicon4.png", // Ganti ke favicon utama
  "./images/LOGO1.png", // Cache logo
  // Tambahkan gambar penting lainnya jika perlu
  "./manifest.json", // Cache manifest
  "https://cdnjs.cloudflare.com/ajax/libs/remixicon/4.6.0/remixicon.min.css", // Cache font icon
  // Jangan cache file eksternal yang sering berubah atau tidak penting offline
];

// 1. Install Service Worker & Pre-cache App Shell
self.addEventListener("install", (event) => {
  console.log(`[SW ${STATIC_CACHE_NAME}] Install event`);
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log(`[SW ${STATIC_CACHE_NAME}] Pre-caching App Shell...`);
      // Tambahkan .catch() untuk menangani error jika salah satu file gagal di-cache
      return cache.addAll(APP_SHELL_ASSETS).catch(error => {
          console.error(`[SW ${STATIC_CACHE_NAME}] Failed to cache App Shell:`, error);
          // Anda bisa memutuskan untuk tidak mengaktifkan SW jika cache gagal
          // throw error; // Uncomment ini jika ingin instalasi gagal jika ada error cache
      });
    }).then(() => {
        // Paksa SW baru untuk aktif segera setelah instalasi selesai
        console.log(`[SW ${STATIC_CACHE_NAME}] Skip waiting on install.`);
        return self.skipWaiting();
    })
  );
});

// 2. Aktifkan Service Worker & Hapus Cache Lama
self.addEventListener("activate", (event) => {
  console.log(`[SW ${STATIC_CACHE_NAME}] Activate event`);
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Hapus semua cache KECUALI static dan dynamic cache versi SEKARANG
          if (key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME) {
            console.log(`[SW ${STATIC_CACHE_NAME}] Deleting old cache:`, key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
        // Ambil alih kontrol halaman segera setelah SW aktif
        console.log(`[SW ${STATIC_CACHE_NAME}] Claiming clients.`);
        return self.clients.claim();
    })
  );
});

// 3. Intercept Fetch Requests (Stale-While-Revalidate Strategy untuk App Shell, Cache First untuk lainnya)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Abaikan request non-GET dan request ke Firebase/eksternal non-cacheable
  if (event.request.method !== 'GET' || url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }
  // Khusus request ke Firebase/API eksternal (selalu ambil dari network)
  if (url.hostname.includes('firebase') || url.hostname.includes('firestore.googleapis.com') || url.hostname.includes('googleusercontent.com')) {
      event.respondWith(fetch(event.request));
      return;
  }

  // Strategi untuk App Shell Assets (Stale-While-Revalidate)
  // Periksa apakah path URL ada di APP_SHELL_ASSETS
  // Gunakan URL pathname untuk mencocokkan (lebih akurat daripada endsWith)
  const isAppShellAsset = APP_SHELL_ASSETS.includes('.' + url.pathname) || APP_SHELL_ASSETS.includes(url.pathname) || (url.pathname === '/' && APP_SHELL_ASSETS.includes('./'));

  if (isAppShellAsset) {
    event.respondWith(
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            // Periksa apakah response valid sebelum caching
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(error => {
              console.warn(`[SW ${STATIC_CACHE_NAME}] Network fetch failed for ${event.request.url}:`, error);
              // Jika network gagal & ada cache, kembalikan cache
              // Jika tidak ada cache, error akan dilempar ke browser
          });

          // Kembalikan dari cache jika ada, sambil coba update di background
          // Atau kembalikan dari network jika cache tidak ada
          return cachedResponse || fetchPromise;
        });
      })
    );
  } else {
    // Strategi Cache-First (dengan fallback ke network) untuk aset dinamis (gambar produk, dll.)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request).then((networkResponse) => {
          // Hanya cache response yang valid
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              return caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse.clone());
                  return networkResponse;
              });
          }
          return networkResponse; // Kembalikan response network apa adanya jika tidak valid
        }).catch(() => {
          // Jika request BUKAN navigasi halaman (cth: gambar) dan gagal, jangan fallback ke offline.html
          if (event.request.mode === 'navigate') {
            // Jika semua gagal (offline dan tidak ada di cache), tampilkan halaman offline
            return caches.match("./offline.html");
          }
          // Untuk request lain (gambar, dll) biarkan browser menangani error
        });
      })
    );
  }
});