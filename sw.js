// Nama cache
const CACHE_NAME = "kopimatcha-cache-v1";

// Daftar file yang akan di-cache (App Shell)
const urlsToCache = [
  "/",
  "/index.html",
  "/checkout.html",
  "/assets/css/styles.css",
  "/assets/css/checkout.css",
  "/assets/js/main.js",
  "/assets/js/checkout.js",
  "/assets/js/firebase-config.js",
  "/assets/img/favicon.png",
  "/assets/img/home-coffee.png",
  "https://fonts.googleapis.com/css2?family=Montserrat:wght@100..900&family=Saira:wght@100..900&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/remixicon/4.6.0/remixicon.min.css",
];

// Event saat Service Worker di-install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Cache dibuka");
      return cache.addAll(urlsToCache);
    })
  );
});

// Event saat ada request (fetch)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Jika request ada di cache, kembalikan dari cache
      if (response) {
        return response;
      }
      // Jika tidak, lakukan request ke jaringan
      return fetch(event.request);
    })
  );
});
