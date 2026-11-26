/*
 * Service worker de notificaciones del chat.
 * Recibe el push enviado por netlify/functions/notify.mjs y muestra la notificación,
 * aunque la página esté cerrada. Al tocarla se abre (o se enfoca) el chat.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  event.waitUntil((async () => {
    // Si la página del aviso (p. ej. el chat) ya está abierta y enfocada, se ve ahí: no hace falta avisar
    const target = new URL(data.url || '/chat', self.location.origin).pathname
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (wins.some((w) => w.focused && new URL(w.url).pathname.startsWith(target))) return

    await self.registration.showNotification(data.title || 'Nuevo mensaje', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      tag: data.tag || 'chat',
      renotify: true,
      vibrate: [120, 60, 120],
      data: { url: data.url || '/chat' },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/chat', self.location.origin).href

  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const same = wins.filter((w) => new URL(w.url).origin === self.location.origin)
    // 1) Una pestaña que ya está en la página del aviso (chat, cápsula o pregunta)
    const path = new URL(url).pathname
    const already = same.find((w) => new URL(w.url).pathname.startsWith(path))
    if (already) return already.focus()
    // 2) Otra pestaña de la página: se lleva a esa ruta (navigate solo funciona si el SW la controla)
    for (const w of same) {
      try {
        const moved = await w.navigate(url)
        if (moved) return moved.focus()
      } catch { /* no controlada: se prueba la siguiente */ }
    }
    // 3) Ninguna sirve: se abre una nueva
    await self.clients.openWindow(url)
  })())
})
