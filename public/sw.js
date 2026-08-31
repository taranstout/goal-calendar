const CACHE_NAME = 'goal-calendar-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim())
})

// Handle notification scheduling
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay } = e.data
    if (delay > 0) {
      setTimeout(() => {
        self.registration.showNotification(title, {
          body,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: `event-${Date.now()}`,
        })
      }, delay)
    }
  }
})

// Notification click — open app
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then((list) => {
      if (list.length) return list[0].focus()
      return clients.openWindow('/')
    })
  )
})
