const CACHE_NAME = "lan-messenger-v6";
const SHELL = [
    "/",
    "/css/styles.css",
    "/js/app.js",
    "/manifest.webmanifest",
    "/socket.io/socket.io.js",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-maskable-192.png",
    "/icons/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                if (response && response.status === 200 && response.type === "basic") {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                }
                return response;
            });
        }).catch(() => caches.match("/"))
    );
});

self.addEventListener("notificationclick", (event) => {
    const conv = (event.notification.data && event.notification.data.conv) || null;
    event.notification.close();

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if ("focus" in client) {
                    client.postMessage({ type: "notif-click", conv });
                    return client.focus();
                }
            }
            return self.clients.openWindow(conv ? "/?open=" + encodeURIComponent(conv) : "/");
        })
    );
});