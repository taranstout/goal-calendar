let swRegistration = null

export async function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return false
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js')
    return true
  } catch {
    return false
  }
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  return result
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export function scheduleEventNotification(event, minutesBefore = 10) {
  if (!swRegistration || Notification.permission !== 'granted') return
  if (!event.time) return

  const [h, m] = event.time.split(':').map(Number)
  const eventDate = new Date(event.date)
  eventDate.setHours(h, m, 0, 0)

  const notifyAt = new Date(eventDate.getTime() - minutesBefore * 60000)
  const delay = notifyAt.getTime() - Date.now()

  if (delay <= 0) return // Already past

  if (swRegistration.active) {
    swRegistration.active.postMessage({
      type: 'SCHEDULE_NOTIFICATION',
      title: event.title,
      body: `Starting in ${minutesBefore} minutes`,
      delay,
    })
  }
}

export function scheduleTodayNotifications(events, minutesBefore = 10) {
  if (Notification.permission !== 'granted') return
  const today = new Date().toISOString().split('T')[0]
  for (const ev of events) {
    if (ev.time) {
      const evDate = ev.date?.split?.('T')?.[0] || ev.date
      if (evDate === today || ev.recurrence) {
        scheduleEventNotification({ ...ev, date: today }, minutesBefore)
      }
    }
  }
}
