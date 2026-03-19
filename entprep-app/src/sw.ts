/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// ── SW activation: only via user action (UpdatePrompt), never auto ──────
// Don't skipWaiting on install — wait for user to accept update via prompt.
// This prevents page reloads during OAuth flows.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Workbox precaching (injected by vite-plugin-pwa) ─────────────────────
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── Navigation fallback (SPA) ────────────────────────────────────────────
const navigationRoute = new NavigationRoute(
  new NetworkFirst({ cacheName: 'navigation', networkTimeoutSeconds: 3 }),
  { denylist: [/^\/api\//] }
);
registerRoute(navigationRoute);

// ── Runtime caching ──────────────────────────────────────────────────────
// NOTE: Supabase API is NOT cached by SW — questionStore has its own
// 3-tier cache (memCache → localStorage → static). SW caching broke
// paginated fetches because .range() uses Range header, not URL params,
// so all pages got the same cached response.

registerRoute(
  /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 31536000 })],
  })
);

// ── Push notification handler ────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const { title, body, icon, tag, url, badge } = payload;
    event.waitUntil(
      self.registration.showNotification(title || 'ENTprep', {
        body: body || '',
        icon: icon || '/icon-192.png',
        badge: badge || '/icon-96.png',
        tag: tag || 'entprep-general',
        data: { url: url || '/' },
        vibrate: [100, 50, 100],
      } as NotificationOptions)
    );
  } catch {
    event.waitUntil(
      self.registration.showNotification('ENTprep', {
        body: event.data.text(),
        icon: '/icon-192.png',
      })
    );
  }
});

// ── Notification click handler ───────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          return (client as WindowClient).focus().then((c) => c.navigate(url));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
