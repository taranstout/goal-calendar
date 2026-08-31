import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Calendar from './pages/Calendar'
import Goals from './pages/Goals'
import Notes from './pages/Notes'
import WeeklyPlan from './pages/WeeklyPlan'
import Settings from './pages/Settings'
import Tasks from './pages/Tasks'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useTheme } from './hooks/useTheme'
import { DEFAULT_EVENT_TYPES } from './utils/eventTypes'
import { getPeriodKey } from './utils/goalPeriods'
import { initServiceWorker, scheduleTodayNotifications, getNotificationPermission } from './utils/notifications'
import './App.css'

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function applyAccentColor(hex, isDark) {
  const [r, g, b] = hexToRgb(hex)
  const root = document.documentElement
  if (isDark) {
    const lr = Math.min(255, r + 40)
    const lg = Math.min(255, g + 40)
    const lb = Math.min(255, b + 40)
    root.style.setProperty('--accent', `rgb(${lr},${lg},${lb})`)
    root.style.setProperty('--accent-light', `rgba(${r},${g},${b},.15)`)
  } else {
    root.style.setProperty('--accent', hex)
    root.style.setProperty('--accent-light', `rgba(${r},${g},${b},.1)`)
  }
}

export default function App() {
  const [events, setEvents] = useLocalStorage('events', [])
  const [goals, setGoals] = useLocalStorage('goals', [])
  const [eventTypes, setEventTypes] = useLocalStorage('eventTypes', DEFAULT_EVENT_TYPES)
  const [accentColor, setAccentColor] = useLocalStorage('accentColor', '#6366f1')
  const [notifEnabled, setNotifEnabled] = useLocalStorage('notifEnabled', false)
  const [notes, setNotes] = useLocalStorage('notes', [])
  const [notifMinutes, setNotifMinutes] = useLocalStorage('notifMinutes', 10)
  const [calendars, setCalendars] = useLocalStorage('calendars', [
    { id: 'default', name: 'My Schedule' },
  ])
  const [dark, toggleTheme] = useTheme()

  // Migrate: star exam type by default
  useEffect(() => {
    setEventTypes((prev) => {
      const exam = prev.find((t) => t.id === 'exam')
      if (exam && exam.starred === undefined) {
        return prev.map((t) => t.id === 'exam' ? { ...t, starred: true } : t)
      }
      return prev
    })
  }, [])

  // Migrate old goals from `current` to `progress` format
  useEffect(() => {
    setGoals((prev) => {
      const needsMigration = prev.some((g) => g.current !== undefined && !g.progress)
      if (!needsMigration) return prev
      return prev.map((g) => {
        if (g.progress) return g
        const key = getPeriodKey(g.frequency || 'weekly')
        const progress = {}
        if (g.current) progress[key] = g.current
        const { current, ...rest } = g
        return { ...rest, progress }
      })
    })
  }, [])

  // Init service worker and schedule notifications
  useEffect(() => {
    initServiceWorker()
  }, [])

  useEffect(() => {
    if (notifEnabled && getNotificationPermission() === 'granted') {
      scheduleTodayNotifications(events, notifMinutes)
    }
  }, [events, notifEnabled, notifMinutes])

  // Apply accent color on mount and when it changes
  useEffect(() => {
    applyAccentColor(accentColor, dark)
  }, [accentColor, dark])

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home goals={goals} setGoals={setGoals} events={events} setEvents={setEvents} notes={notes} setNotes={setNotes} eventTypes={eventTypes} calendars={calendars} />} />
        <Route path="/calendar" element={<Calendar events={events} setEvents={setEvents} eventTypes={eventTypes} goals={goals} setGoals={setGoals} calendars={calendars} setCalendars={setCalendars} />} />
        <Route path="/tasks" element={<Tasks events={events} setEvents={setEvents} eventTypes={eventTypes} />} />
        <Route path="/goals" element={<Goals goals={goals} setGoals={setGoals} />} />
        <Route path="/notes" element={<Notes notes={notes} setNotes={setNotes} />} />
        <Route path="/weekly" element={<WeeklyPlan />} />
        <Route path="/settings" element={<Settings dark={dark} toggleTheme={toggleTheme} eventTypes={eventTypes} setEventTypes={setEventTypes} accentColor={accentColor} setAccentColor={setAccentColor} notifEnabled={notifEnabled} setNotifEnabled={setNotifEnabled} notifMinutes={notifMinutes} setNotifMinutes={setNotifMinutes} />} />
      </Routes>
    </Layout>
  )
}
