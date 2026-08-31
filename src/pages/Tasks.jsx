import { useEffect } from 'react'
import { format, isToday, isTomorrow, isBefore, startOfDay } from 'date-fns'
import { getEventType } from '../utils/eventTypes'
import { eventOccursOn } from '../utils/recurrence'
import PageBanner from '../components/PageBanner'

export default function Tasks({ events, setEvents, eventTypes }) {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  // Collect all task-type events, expand recurring ones for the next 90 days
  const today = startOfDay(new Date())
  const taskEntries = []

  const taskEvents = events.filter((e) => e.type === 'task')

  for (const ev of taskEvents) {
    if (!ev.recurrence || ev.recurrence === 'none') {
      const evDate = startOfDay(new Date(ev.date))
      if (!isBefore(evDate, today)) {
        taskEntries.push({ ...ev, displayDate: evDate })
      }
    } else {
      // Expand recurring tasks for the next 90 days
      for (let i = 0; i < 90; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() + i)
        if (eventOccursOn(ev, d)) {
          taskEntries.push({ ...ev, displayDate: startOfDay(d), isRecurring: true })
        }
      }
    }
  }

  // Also include past undone tasks (overdue)
  for (const ev of taskEvents) {
    if ((!ev.recurrence || ev.recurrence === 'none') && !ev.done) {
      const evDate = startOfDay(new Date(ev.date))
      if (isBefore(evDate, today)) {
        taskEntries.push({ ...ev, displayDate: evDate, overdue: true })
      }
    }
  }

  // Sort chronologically
  taskEntries.sort((a, b) => a.displayDate - b.displayDate)

  const toggleDone = (id) => {
    setEvents((prev) =>
      prev.map((ev) => ev.id === id ? { ...ev, done: !ev.done } : ev)
    )
  }

  const formatTime12 = (timeStr) => {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${String(m).padStart(2, '0')} ${period}`
  }

  const formatDateLabel = (date) => {
    if (isToday(date)) return 'Today'
    if (isTomorrow(date)) return 'Tomorrow'
    return format(date, 'EEE, MMM d')
  }

  // Group by date
  const grouped = []
  for (const entry of taskEntries) {
    const key = entry.displayDate.toISOString()
    const last = grouped[grouped.length - 1]
    if (last && last.key === key) {
      last.tasks.push(entry)
    } else {
      grouped.push({ key, date: entry.displayDate, tasks: [entry] })
    }
  }

  return (
    <div className="page">
      <PageBanner><h1>Tasks</h1></PageBanner>

      {grouped.length === 0 ? (
        <div className="card">
          <p className="muted">No upcoming tasks. Add a task from the calendar by choosing "Task" as the event type.</p>
        </div>
      ) : (
        grouped.map((group) => (
          <div key={group.key} className="card task-group">
            <h2 className={group.tasks[0]?.overdue ? 'overdue-label' : ''}>
              {group.tasks[0]?.overdue && 'Overdue — '}
              {formatDateLabel(group.date)}
            </h2>
            <div className="task-list">
              {group.tasks.map((task, idx) => (
                <div
                  key={`${task.id}-${idx}`}
                  className={`task-row${task.done ? ' task-completed' : ''}`}
                  onClick={() => toggleDone(task.id)}
                >
                  <span className={`task-checkbox${task.done ? ' checked' : ''}`}>
                    {task.done ? '✓' : ''}
                  </span>
                  <div className="task-info">
                    <span className={`task-title${task.done ? ' task-done-text' : ''}`}>
                      {task.title}
                    </span>
                    <span className="task-meta">
                      {task.time && <span>{formatTime12(task.time)}{task.endTime ? ` – ${formatTime12(task.endTime)}` : ''}</span>}
                      {task.isRecurring && <span className="task-recurring">↻</span>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
