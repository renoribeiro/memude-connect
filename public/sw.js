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
    const visivel = janelas.some((c) => c.visibilityState === 'visible');
    // Com o app aberto, a própria tela toca o som e atualiza
    janelas.forEach((c) => c.postMessage({ tipo: 'push', ...d }));
    // Todo push precisa mostrar uma notificação (o iPhone revoga a permissão se não mostrar).
    // Com o app na tela e sem urgência, ela sai silenciosa e some sozinha.
    const discreta = visivel && !urgente;
    await self.registration.showNotification(d.titulo || 'MeMude', {
      body: d.corpo || '',
      tag,
      renotify: !discreta,
      silent: discreta,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: d.url || '/' },
      requireInteraction: urgente,
      vibrate: discreta ? undefined : urgente ? [300, 120, 300, 120, 600] : [120, 60, 120],
    });
    if (discreta) {
      await new Promise((r) => setTimeout(r, 4000));
      const abertas = await self.registration.getNotifications({ tag });
      abertas.forEach((n) => n.close());
    }
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const minha = janelas.find((c) => new URL(c.url).origin === self.location.origin);
    if (minha) {
      // Leva a janela aberta direto para a tela certa (funciona em qualquer página do Connect)
      try {
        const nova = 'navigate' in minha ? await minha.navigate(destino) : null;
        await (nova || minha).focus();
        if (!nova) minha.postMessage({ tipo: 'navegar', url: destino });
      } catch {
        await minha.focus().catch(() => undefined);
        minha.postMessage({ tipo: 'navegar', url: destino });
      }
      return;
    }
    await self.clients.openWindow(destino);
  })());
});
