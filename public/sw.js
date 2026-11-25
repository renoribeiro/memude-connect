/* MeMude — service worker: só notificações push (nada de cache, para nunca servir versão velha do app). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { titulo: 'MeMude', corpo: e.data ? e.data.text() : '' }; }
  const tag = d.tag || 'memude';
  const urgente = tag.startsWith('convite-');
  e.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // App aberto e visível: avisa a tela (ela toca o som e mostra o aviso); a notificação aparece mesmo assim se for convite
    const visivel = janelas.find((c) => c.visibilityState === 'visible');
    janelas.forEach((c) => c.postMessage({ tipo: 'push', ...d }));
    if (visivel && !urgente) return;
    await self.registration.showNotification(d.titulo || 'MeMude', {
      body: d.corpo || '',
      tag,
      renotify: true,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: d.url || '/' },
      requireInteraction: urgente,
      vibrate: urgente ? [300, 120, 300, 120, 600] : [120, 60, 120],
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const minha = janelas.find((c) => new URL(c.url).origin === self.location.origin);
    if (minha) {
      await minha.focus();
      minha.postMessage({ tipo: 'navegar', url: destino });
      return;
    }
    await self.clients.openWindow(destino);
  })());
});
