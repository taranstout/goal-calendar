import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import {
  format,
  addDays,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  isBefore,
  isSameDay,
  startOfDay,
  getMonth,
  getDay,
} from 'date-fns'
import { v4 as uuid } from 'uuid'
import { getEventType } from '../utils/eventTypes'
import PageBanner from '../components/PageBanner'
import { RECURRENCE_OPTIONS, eventOccursOn } from '../utils/recurrence'
import { getPeriodKey } from '../utils/goalPeriods'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DEFAULT_HOUR_HEIGHT = 56
const MIN_HOUR_HEIGHT = 36
const MAX_HOUR_HEIGHT = 160
const LABEL_W = 60
const HOLD_MS = 400
const TASK_HEIGHT = 30

function formatHour(h) {
  if (h === 0) return '12:00 AM'
  if (h < 12) return `${h}:00 AM`
  if (h === 12) return '12:00 PM'
  return `${h - 12}:00 PM`
}

function displayTime(mins) {
  const h24 = Math.floor(mins / 60) % 24
  const m = mins % 60
  const period = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(mins) {
  const c = Math.max(0, Math.min(mins, 23 * 60 + 59))
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`
}

function tintColor(hex, amount = 0.08) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const tr = Math.round(r * amount + 255 * (1 - amount))
  const tg = Math.round(g * amount + 255 * (1 - amount))
  const tb = Math.round(b * amount + 255 * (1 - amount))
  return `rgb(${tr},${tg},${tb})`
}

function nowMinutes() {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

function snapMins(mins, hourHeight) {
  // Finer increments at higher zoom
  let inc = 15
  if (hourHeight >= 120) inc = 5
  else if (hourHeight >= 80) inc = 10
  return Math.round(mins / inc) * inc
}

// Compute column layout for overlapping events
function computeLayout(timedEvents, pinnedId) {
  if (!timedEvents.length) return new Map()

  const items = timedEvents.map((ev) => {
    const s = timeToMinutes(ev.time)
    const isTask = ev.type === 'task'
    return { id: ev.id, start: s, end: ev.endTime ? timeToMinutes(ev.endTime) : s + (isTask ? 15 : 60) }
  })

  // Sort pinned event first so it always gets column 0, then by start time
  items.sort((a, b) => {
    if (pinnedId) {
      if (a.id === pinnedId) return -1
      if (b.id === pinnedId) return 1
    }
    return a.start - b.start || (b.end - b.start) - (a.end - a.start)
  })

  const result = new Map()

  if (pinnedId) {
    // During drag: layout stationary events as if dragged event doesn't exist,
    // then overlay the dragged event on top
    const stationary = items.filter((i) => i.id !== pinnedId)
    const pinned = items.find((i) => i.id === pinnedId)

    // Assign columns for stationary events only
    const columns = []
    for (const item of stationary) {
      let col = -1
      for (let c = 0; c < columns.length; c++) {
        if (columns[c] <= item.start) { col = c; break }
      }
      if (col === -1) { col = columns.length; columns.push(0) }
      columns[col] = item.end
      result.set(item.id, { col, totalCols: 1 })
    }

    // Compute totalCols for stationary events (among themselves)
    for (const item of stationary) {
      let maxCol = result.get(item.id).col
      for (const other of stationary) {
        if (other.start < item.end && other.end > item.start) {
          maxCol = Math.max(maxCol, result.get(other.id).col)
        }
      }
      const total = maxCol + 1
      for (const other of stationary) {
        if (other.start < item.end && other.end > item.start) {
          const r = result.get(other.id)
          r.totalCols = Math.max(r.totalCols, total)
        }
      }
    }

    // Place pinned event at column 0, push stationary events right
    if (pinned) {
      let hasOverlap = false
      for (const other of stationary) {
        if (other.start < pinned.end && other.end > pinned.start) {
          hasOverlap = true
          const r = result.get(other.id)
          r.col = r.col + 1
          r.totalCols = r.totalCols + 1
        }
      }
      result.set(pinnedId, { col: 0, totalCols: hasOverlap ? 2 : 1 })
    }
  } else {
    const columns = []
    for (const item of items) {
      let col = -1
      for (let c = 0; c < columns.length; c++) {
        if (columns[c] <= item.start) { col = c; break }
      }
      if (col === -1) { col = columns.length; columns.push(0) }
      columns[col] = item.end
      result.set(item.id, { col, totalCols: 1 })
    }

    for (const item of items) {
      let maxCol = result.get(item.id).col
      for (const other of items) {
        if (other.start < item.end && other.end > item.start) {
          maxCol = Math.max(maxCol, result.get(other.id).col)
        }
      }
      const total = maxCol + 1
      for (const other of items) {
        if (other.start < item.end && other.end > item.start) {
          const r = result.get(other.id)
          r.totalCols = Math.max(r.totalCols, total)
        }
      }
    }
  }

  return result
}

export default function Calendar({ events, setEvents, eventTypes, goals, setGoals, calendars = [], setCalendars }) {
  const [viewMonth, setViewMonth] = useState(() => {
    const saved = sessionStorage.getItem('cal-date')
    return startOfMonth(saved ? new Date(saved) : new Date())
  })
  const [currentDate, setCurrentDate] = useState(() => {
    const saved = sessionStorage.getItem('cal-date')
    return startOfDay(saved ? new Date(saved) : new Date())
  })
  const [showForm, setShowForm] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [step, setStep] = useState('pick-type')
  const [selectedType, setSelectedType] = useState(null)
  const [form, setForm] = useState({
    title: '', time: '', endTime: '', note: '',
    recurrence: 'none', recurrenceEnd: '',
    customEvery: '1', customUnit: 'weeks', customDays: [],
    goalId: '',
  })

  const [nowMins, setNowMins] = useState(nowMinutes())
  const [hourHeight, setHourHeight] = useState(DEFAULT_HOUR_HEIGHT)
  const pinchRef = useRef(null)
  const hourGridRef = useRef(null)
  const stripRef = useRef(null)
  const bannerRef = useRef(null)
  const pinnedRef = useRef(null)
  const activeRef = useRef(null)
  const dragRef = useRef(null)
  const [dragId, setDragId] = useState(null)
  const [dragZone, setDragZone] = useState(null)
  const [dragReady, setDragReady] = useState(null) // { id, zone } — held but not yet moved
  const [repeatPrompt, setRepeatPrompt] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', time: '', endTime: '', note: '' })
  const [editRepeatPrompt, setEditRepeatPrompt] = useState(null)

  // Multi-calendar state
  const [activeCalendarId, setActiveCalendarId] = useState(() => {
    return sessionStorage.getItem('cal-active') || 'default'
  })
  const [showCalendarPicker, setShowCalendarPicker] = useState(false)
  const [newCalName, setNewCalName] = useState('')
  const [showNewCalInput, setShowNewCalInput] = useState(false)
  const calMenuRef = useRef(null)

  // Draft event state
  const [draft, setDraft] = useState(null) // { start, end } in minutes
  const draftDragRef = useRef(null)

  // Swipe to change day with slide animation
  const swipeRef = useRef(null)
  const scheduleRef = useRef(null)

  const handleSwipeStart = useCallback((e) => {
    if (dragRef.current) return
    if (draftDragRef.current) return
    const touch = e.touches[0]
    swipeRef.current = { startX: touch.clientX, startY: touch.clientY, locked: null }
  }, [])

  const handleSwipeMove = useCallback((e) => {
    const sw = swipeRef.current
    if (!sw || sw.locked === 'scroll') return
    const touch = e.touches[0]
    const dx = touch.clientX - sw.startX
    const dy = touch.clientY - sw.startY

    // Decide direction lock after a small movement
    if (sw.locked === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      if (Math.abs(dy) > Math.abs(dx)) {
        sw.locked = 'scroll'
        return
      }
      sw.locked = 'swipe'
    }

    if (sw.locked !== 'swipe') return

    // Apply live drag offset
    if (scheduleRef.current) {
      scheduleRef.current.style.transition = 'none'
      scheduleRef.current.style.transform = `translateX(${dx}px)`
      scheduleRef.current.style.opacity = `${1 - Math.min(Math.abs(dx) / 500, 0.3)}`
    }
  }, [])

  const handleSwipeEnd = useCallback(() => {
    const sw = swipeRef.current
    if (!sw || sw.locked !== 'swipe') {
      swipeRef.current = null
      return
    }

    const el = scheduleRef.current
    if (!el) { swipeRef.current = null; return }

    const matrix = new DOMMatrix(getComputedStyle(el).transform)
    const dx = matrix.m41

    if (Math.abs(dx) > 60) {
      const direction = dx < 0 ? 1 : -1
      // Slide off screen smoothly
      el.style.transition = 'transform .2s ease-in, opacity .2s ease-in'
      el.style.transform = `translateX(${direction < 0 ? 100 : -100}%)`
      el.style.opacity = '0'

      const onDone = () => {
        el.removeEventListener('transitionend', onDone)
        // Change the day
        const newDate = addDays(currentDate, direction)
        setCurrentDate(newDate)
        if (getMonth(newDate) !== getMonth(viewMonth)) {
          setViewMonth(startOfMonth(newDate))
        }
        // Instantly position on the opposite side, then slide in
        el.style.transition = 'none'
        el.style.transform = `translateX(${direction > 0 ? 60 : -60}px)`
        el.style.opacity = '0'
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.style.transition = 'transform .25s ease-out, opacity .25s ease-out'
            el.style.transform = 'translateX(0)'
            el.style.opacity = '1'
            const cleanup = () => {
              el.removeEventListener('transitionend', cleanup)
              el.style.transition = ''
              el.style.transform = ''
              el.style.opacity = ''
            }
            el.addEventListener('transitionend', cleanup, { once: true })
          })
        })
      }
      el.addEventListener('transitionend', onDone, { once: true })
    } else {
      // Snap back
      el.style.transition = 'transform .2s ease, opacity .2s ease'
      el.style.transform = 'translateX(0)'
      el.style.opacity = '1'
      const cleanup = () => {
        el.removeEventListener('transitionend', cleanup)
        el.style.transition = ''
        el.style.transform = ''
        el.style.opacity = ''
      }
      el.addEventListener('transitionend', cleanup, { once: true })
    }

    swipeRef.current = null
  }, [currentDate, viewMonth])

  const days = eachDayOfInterval({
    start: addDays(startOfMonth(viewMonth), -30),
    end: addDays(endOfMonth(viewMonth), 30),
  })

  useEffect(() => { scrollToTime() }, [])
  useEffect(() => {
    sessionStorage.setItem('cal-date', currentDate.toISOString())
    setDraft(null)
    setShowAllTasks(false)
    scrollToTime()
  }, [currentDate])

  useEffect(() => {
    sessionStorage.setItem('cal-active', activeCalendarId)
  }, [activeCalendarId])

  // Close calendar menu on outside click

  // Lock body scroll when modal is open to prevent scroll jumping
  const savedScrollY = useRef(0)
  useEffect(() => {
    const modalOpen = showForm || !!editingEvent || !!editRepeatPrompt
    if (modalOpen) {
      savedScrollY.current = window.scrollY
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.style.top = `-${savedScrollY.current}px`
    } else {
      if (document.body.style.position === 'fixed') {
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.width = ''
        document.body.style.top = ''
        window.scrollTo(0, savedScrollY.current)
      }
    }
  }, [showForm, editingEvent, editRepeatPrompt])

  useEffect(() => {
    const t = setInterval(() => setNowMins(nowMinutes()), 60000)
    return () => clearInterval(t)
  }, [])

  function scrollToTime() {
    requestAnimationFrame(() => {
      if (!hourGridRef.current) return
      const gridTop = hourGridRef.current.getBoundingClientRect().top + window.scrollY
      if (isToday(currentDate)) {
        const currentMins = nowMinutes()
        const targetY = gridTop + (currentMins / 60) * hourHeight - window.innerHeight / 3
        window.scrollTo(0, Math.max(0, targetY))
      } else {
        const targetY = gridTop + 6 * hourHeight
        window.scrollTo(0, Math.max(0, targetY))
      }
    })
  }

  // Pinch-to-zoom on the hour grid
  useEffect(() => {
    const grid = hourGridRef.current
    if (!grid) return
    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )
        pinchRef.current = { startDist: d, startHeight: hourHeight }
      }
    }
    const onTouchMove = (e) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )
        const scale = d / pinchRef.current.startDist
        const newH = Math.round(Math.min(MAX_HOUR_HEIGHT, Math.max(MIN_HOUR_HEIGHT, pinchRef.current.startHeight * scale)))
        setHourHeight(newH)
      }
    }
    const onTouchEnd = () => { pinchRef.current = null }
    grid.addEventListener('touchstart', onTouchStart, { passive: true })
    grid.addEventListener('touchmove', onTouchMove, { passive: false })
    grid.addEventListener('touchend', onTouchEnd)
    grid.addEventListener('touchcancel', onTouchEnd)
    return () => {
      grid.removeEventListener('touchstart', onTouchStart)
      grid.removeEventListener('touchmove', onTouchMove)
      grid.removeEventListener('touchend', onTouchEnd)
      grid.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [hourHeight])

  useEffect(() => {
    if (activeRef.current && stripRef.current) {
      const strip = stripRef.current
      const el = activeRef.current
      strip.scrollLeft = el.offsetLeft - strip.offsetWidth / 2 + el.offsetWidth / 2
    }
  }, [viewMonth, currentDate])

  // Position day strip and pinned tasks below banner
  const positionFixed = useCallback(() => {
    if (!bannerRef.current || !stripRef.current) return
    const bannerBottom = bannerRef.current.getBoundingClientRect().bottom
    stripRef.current.style.top = `${bannerBottom}px`
    if (pinnedRef.current) {
      const stripBottom = stripRef.current.getBoundingClientRect().bottom
      pinnedRef.current.style.top = `${stripBottom - 1}px`
    }
  }, [])

  useLayoutEffect(() => {
    positionFixed()
  })

  useEffect(() => {
    window.addEventListener('resize', positionFixed)
    return () => window.removeEventListener('resize', positionFixed)
  }, [positionFixed])

  // Lock scroll direction on day schedule — prevent diagonal scrolling
  useEffect(() => {
    const el = scheduleRef.current
    if (!el) return
    const onTouchMove = (e) => {
      const sw = swipeRef.current
      if (!sw || sw.locked === null) return
      // When locked to horizontal swipe, prevent vertical scroll
      if (sw.locked === 'swipe') {
        e.preventDefault()
      }
      // When locked to vertical scroll, prevent any horizontal drift
      if (sw.locked === 'scroll') {
        const touch = e.touches[0]
        const dx = Math.abs(touch.clientX - sw.startX)
        const dy = Math.abs(touch.clientY - sw.startY)
        if (dx > 10 && dx > dy * 0.5) {
          e.preventDefault()
        }
      }
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [])

  const eventsOn = useCallback(
    (date) => {
      const dateKey = format(date, 'yyyy-MM-dd')
      return events
        .filter((e) => {
          // Filter by active calendar
          const evCalId = e.calendarId || 'default'
          if (evCalId !== activeCalendarId) return false
          if ((e.excludedDates || []).includes(dateKey)) return false
          return eventOccursOn(e, date)
        })
        .map((e) => {
          const override = (e.overrides || {})[dateKey]
          return override ? { ...e, ...override } : e
        })
    },
    [events, activeCalendarId]
  )

  const isTask = selectedType === 'task'

  const [fabOpen, setFabOpen] = useState(false)

  const openModal = (date, startMins, endMins, fromFab) => {
    setSelectedDate(date)
    setStep('pick-type')
    setSelectedType(null)
    setFabOpen(!!fromFab)
    const resolvedEnd = endMins != null ? endMins : Math.min(startMins + 60, 23 * 60 + 59)
    setForm({
      title: '',
      time: fromFab ? '' : minutesToTime(startMins),
      endTime: fromFab ? '' : minutesToTime(resolvedEnd),
      note: '',
      recurrence: 'none',
      recurrenceEnd: '',
      customEvery: '1',
      customUnit: 'weeks',
      customDays: [],
      goalId: '',
    })
    setShowForm(true)
  }

  // ---- Tap-to-create-draft + hold-to-drag-create ----
  const gridTapRef = useRef(null)
  const holdCreateRef = useRef(null)

  const clientYToMins = useCallback((clientY) => {
    const grid = hourGridRef.current
    if (!grid) return 0
    const rect = grid.getBoundingClientRect()
    const raw = ((clientY - rect.top + grid.scrollTop) / hourHeight) * 60
    return Math.max(0, Math.min(raw, 24 * 60))
  }, [hourHeight])

  const handleGridTouchStart = useCallback((e) => {
    if (e.target.closest('.cal-event') || e.target.closest('.draft-event')) return
    const touch = e.touches[0]
    gridTapRef.current = { startX: touch.clientX, startY: touch.clientY }

    // Start hold timer for drag-create
    const rawMins = clientYToMins(touch.clientY)
    const snapped = Math.round(rawMins / 30) * 30
    const anchorStart = Math.max(0, Math.min(snapped, 23 * 60))
    holdCreateRef.current = {
      timer: setTimeout(() => {
        const hc = holdCreateRef.current
        if (!hc || hc.cancelled) return
        hc.active = true
        hc.initialEnd = Math.min(anchorStart + 60, 24 * 60)
        gridTapRef.current = null // no longer a tap
        setDraft({ start: anchorStart, end: hc.initialEnd })
      }, 400),
      anchorStart,
      initialEnd: Math.min(anchorStart + 60, 24 * 60),
      active: false,
      cancelled: false,
    }
  }, [clientYToMins])

  const handleGridTouchMove = useCallback((e) => {
    const hc = holdCreateRef.current
    // Cancel hold if finger moves before hold triggers
    if (hc && !hc.active && !hc.cancelled) {
      const touch = e.touches[0]
      const tap = gridTapRef.current
      if (tap && (Math.abs(touch.clientX - tap.startX) > 8 || Math.abs(touch.clientY - tap.startY) > 8)) {
        clearTimeout(hc.timer)
        hc.cancelled = true
      }
    }
    // Drag-create: extend draft while holding
    if (hc && hc.active) {
      e.preventDefault()
      const touch = e.touches[0]
      const rawMins = clientYToMins(touch.clientY)
      const snapped = snapMins(rawMins, hourHeight)
      setDraft((prev) => {
        if (!prev) return prev
        const anchor = hc.anchorStart
        const initEnd = hc.initialEnd
        // Once user drags past the initial block, unlock free resizing
        if (!hc.unlocked) {
          if (snapped > initEnd) {
            hc.unlocked = true
            hc.unlockDir = 'down'
          } else if (snapped < anchor) {
            hc.unlocked = true
            hc.unlockDir = 'up'
          }
        }
        if (hc.unlocked) {
          if (hc.unlockDir === 'down') {
            // Broke out downward — top fixed at anchor, bottom follows finger
            return { start: anchor, end: Math.max(Math.min(snapped, 24 * 60), anchor + 15) }
          } else {
            // Broke out upward — bottom fixed at initEnd, top follows finger
            return { start: Math.min(Math.max(0, snapped), initEnd - 15), end: initEnd }
          }
        }
        // Still within the initial 1-hour block — keep it
        return { start: anchor, end: initEnd }
      })
      // Auto-scroll near edges
      const edgeZone = 40
      if (touch.clientY < edgeZone) {
        window.scrollBy(0, -6)
      } else if (touch.clientY > window.innerHeight - edgeZone) {
        window.scrollBy(0, 6)
      }
    }
  }, [clientYToMins, hourHeight])

  const handleGridTouchEnd = useCallback((e) => {
    const hc = holdCreateRef.current
    if (hc) {
      clearTimeout(hc.timer)
      const wasActive = hc.active
      holdCreateRef.current = null
      if (wasActive) return // draft already set via drag
    }

    const tap = gridTapRef.current
    if (!tap) return
    gridTapRef.current = null
    if (dragRef.current?.moved) return
    const touch = e.changedTouches[0]
    const dx = Math.abs(touch.clientX - tap.startX)
    const dy = Math.abs(touch.clientY - tap.startY)
    if (dx > 5 || dy > 5) return // was a scroll or swipe
    const rawMins = clientYToMins(touch.clientY)
    const snapped = Math.round(rawMins / 30) * 30
    const start = Math.max(0, Math.min(snapped, 23 * 60))
    const end = Math.min(start + 60, 24 * 60)
    setDraft({ start, end })
  }, [clientYToMins])

  const handleGridClick = useCallback((e) => {
    if (dragRef.current?.moved) return
    if (e.target.closest('.cal-event') || e.target.closest('.draft-event')) return
    const grid = hourGridRef.current
    if (!grid) return
    const rect = grid.getBoundingClientRect()
    const y = e.clientY - rect.top + grid.scrollTop
    const rawMins = (y / hourHeight) * 60
    const snapped = Math.round(rawMins / 30) * 30
    const start = Math.max(0, Math.min(snapped, 23 * 60))
    const end = Math.min(start + 60, 24 * 60)
    setDraft({ start, end })
  }, [hourHeight])

  // Non-passive touchmove for hold-to-drag-create (so preventDefault works)
  useEffect(() => {
    const grid = hourGridRef.current
    if (!grid) return
    const onMove = (e) => handleGridTouchMove(e)
    grid.addEventListener('touchmove', onMove, { passive: false })
    return () => grid.removeEventListener('touchmove', onMove)
  }, [handleGridTouchMove])

  // Draft drag handling
  const startDraftDrag = useCallback((e, mode) => {
    e.stopPropagation()
    e.preventDefault()
    const touch = e.touches[0]
    const grid = hourGridRef.current
    if (!grid) return
    draftDragRef.current = {
      mode, // 'top', 'bottom', 'body'
      startY: touch.clientY,
      origStart: draft.start,
      origEnd: draft.end,
      offset: clientYToMins(touch.clientY) - draft.start,
      scrollTimer: null,
    }
  }, [draft, clientYToMins])

  useEffect(() => {
    const onMove = (e) => {
      const dd = draftDragRef.current
      if (!dd) return
      e.preventDefault()
      const touch = e.touches[0]

      // Auto-scroll near viewport edges
      const edgeZone = 40
      const scrollSpeed = 6
      if (touch.clientY < edgeZone) {
        window.scrollBy(0, -scrollSpeed)
      } else if (touch.clientY > window.innerHeight - edgeZone) {
        window.scrollBy(0, scrollSpeed)
      }

      const rawMins = clientYToMins(touch.clientY)
      const snapped = snapMins(rawMins, hourHeight)

      setDraft((prev) => {
        if (!prev) return prev
        const { mode, origStart, origEnd, offset } = dd
        const duration = origEnd - origStart
        let s = prev.start, en = prev.end

        if (mode === 'top') {
          s = Math.round(Math.max(0, Math.min(snapped, prev.end - 15)))
          en = prev.end
        } else if (mode === 'bottom') {
          s = prev.start
          en = Math.round(Math.min(24 * 60, Math.max(snapped, prev.start + 15)))
        } else {
          // body — move whole block
          s = snapMins(Math.max(0, rawMins - offset), hourHeight)
          en = s + duration
          if (en > 24 * 60) { en = 24 * 60; s = en - duration }
        }
        return { start: Math.round(s), end: Math.round(en) }
      })
    }

    const onEnd = () => {
      draftDragRef.current = null
    }

    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)
    return () => {
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [clientYToMins, hourHeight])

  const handleDraftTap = useCallback(() => {
    if (!draft) return
    openModal(currentDate, draft.start, draft.end)
    setDraft(null)
  }, [draft, currentDate])

  const dismissDraft = useCallback(() => {
    setDraft(null)
  }, [])

  const handleTypeSelect = (typeId) => {
    setSelectedType(typeId)
    // If opened from FAB and picking a non-task type, fill in a default time
    if (fabOpen && typeId !== 'task' && !form.time) {
      const mins = nowMinutes()
      setForm((f) => ({
        ...f,
        time: minutesToTime(mins),
        endTime: minutesToTime(Math.min(mins + 60, 23 * 60 + 59)),
      }))
    }
    setStep('form')
  }

  const handleAdd = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const typeIsTask = selectedType === 'task'
    const newEvent = {
      id: uuid(),
      title: form.title.trim(),
      time: form.time,
      endTime: typeIsTask ? '' : form.endTime,
      note: form.note,
      type: selectedType || 'other',
      date: startOfDay(selectedDate).toISOString(),
      recurrence: form.recurrence,
      recurrenceEnd: form.recurrenceEnd || null,
      goalId: form.goalId || null,
      confirmedDates: [],
      calendarId: activeCalendarId,
    }
    if (form.recurrence === 'custom') {
      newEvent.customRecurrence = {
        every: Number(form.customEvery) || 1,
        unit: form.customUnit,
        days: form.customDays,
      }
    }
    setEvents((prev) => [...prev, newEvent])
    setShowForm(false)
  }

  const handleDelete = (id, e) => {
    if (e) { e.stopPropagation(); e.preventDefault() }
    setEvents((prev) => prev.filter((ev) => ev.id !== id))
  }

  const openEditModal = (ev) => {
    setEditingEvent(ev)
    setEditForm({
      title: ev.title,
      time: ev.time || '',
      endTime: ev.endTime || '',
      note: ev.note || '',
    })
  }

  const handleEditSave = (e) => {
    e.preventDefault()
    if (!editForm.title.trim()) return
    const isRepeating = editingEvent.recurrence && editingEvent.recurrence !== 'none'
    if (isRepeating) {
      // Show prompt to choose all or just this occurrence
      setEditRepeatPrompt({
        eventId: editingEvent.id,
        changes: {
          title: editForm.title.trim(),
          time: editForm.time,
          endTime: editingEvent.type === 'task' ? '' : editForm.endTime,
          note: editForm.note,
        },
        date: format(currentDate, 'yyyy-MM-dd'),
      })
      setEditingEvent(null)
    } else {
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === editingEvent.id
            ? { ...ev, title: editForm.title.trim(), time: editForm.time, endTime: editingEvent.type === 'task' ? '' : editForm.endTime, note: editForm.note }
            : ev
        )
      )
      setEditingEvent(null)
    }
  }

  const applyEditAll = () => {
    const { eventId, changes } = editRepeatPrompt
    setEvents((prev) =>
      prev.map((ev) => ev.id === eventId ? { ...ev, ...changes } : ev)
    )
    setEditRepeatPrompt(null)
  }

  const applyEditThisOnly = () => {
    const { eventId, changes, date } = editRepeatPrompt
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== eventId) return ev
        const overrides = { ...(ev.overrides || {}) }
        overrides[date] = changes
        return { ...ev, overrides }
      })
    )
    setEditRepeatPrompt(null)
  }

  const handleEditDelete = () => {
    const isRepeating = editingEvent.recurrence && editingEvent.recurrence !== 'none'
    if (isRepeating) {
      setEditRepeatPrompt({
        eventId: editingEvent.id,
        deleteMode: true,
        date: format(currentDate, 'yyyy-MM-dd'),
      })
      setEditingEvent(null)
    } else {
      setEvents((prev) => prev.filter((ev) => ev.id !== editingEvent.id))
      setEditingEvent(null)
    }
  }

  const deleteEditAll = () => {
    setEvents((prev) => prev.filter((ev) => ev.id !== editRepeatPrompt.eventId))
    setEditRepeatPrompt(null)
  }

  const deleteEditThisOnly = () => {
    const { eventId, date } = editRepeatPrompt
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== eventId) return ev
        const excludedDates = [...(ev.excludedDates || []), date]
        return { ...ev, excludedDates }
      })
    )
    setEditRepeatPrompt(null)
  }

  const toggleTaskDone = (id, e) => {
    if (e) { e.stopPropagation(); e.preventDefault() }
    setEvents((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, done: !ev.done } : ev))
    )
  }

  const toggleEventConfirmed = (id, date, e) => {
    if (e) { e.stopPropagation(); e.preventDefault() }
    const dateStr = startOfDay(date).toISOString()
    let wasConfirmed = false
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== id) return ev
        const confirmed = ev.confirmedDates || []
        if (confirmed.includes(dateStr)) {
          wasConfirmed = true
          return { ...ev, confirmedDates: confirmed.filter((d) => d !== dateStr) }
        }
        return { ...ev, confirmedDates: [...confirmed, dateStr] }
      })
    )
    // Update linked goal using period-keyed progress
    const ev = events.find((x) => x.id === id)
    if (ev?.goalId) {
      setGoals((prev) =>
        prev.map((g) => {
          if (g.id !== ev.goalId) return g
          const key = getPeriodKey(g.frequency || 'weekly', date)
          const progress = { ...(g.progress || {}) }
          if (wasConfirmed) {
            progress[key] = Math.max((progress[key] || 0) - 1, 0)
          } else {
            progress[key] = Math.min((progress[key] || 0) + 1, g.target)
          }
          return { ...g, progress }
        })
      )
    }
  }

  const toggleCustomDay = (dayIdx) => {
    setForm((f) => ({
      ...f,
      customDays: f.customDays.includes(dayIdx)
        ? f.customDays.filter((d) => d !== dayIdx)
        : [...f.customDays, dayIdx],
    }))
  }

  // ---- Drag to move / resize ----
  const gridMinutes = useCallback((clientY) => {
    const grid = hourGridRef.current
    if (!grid) return 0
    const rect = grid.getBoundingClientRect()
    return snapMins(Math.max(0, ((clientY - rect.top + grid.scrollTop) / hourHeight) * 60), hourHeight)
  }, [hourHeight])

  const startDrag = useCallback(
    (e, eventId) => {
      const ev = events.find((x) => x.id === eventId)
      if (!ev?.time) return
      const touch = e.touches[0]
      const el = e.currentTarget
      const r = el.getBoundingClientRect()
      const yIn = touch.clientY - r.top
      const h = r.height

      let zone = 'move'
      if (yIn <= 14) zone = 'resize-top'
      else if (yIn >= h - 14) zone = 'resize-bottom'

      const sMins = timeToMinutes(ev.time)
      const eMins = ev.endTime ? timeToMinutes(ev.endTime) : sMins + 60
      const touchMins = gridMinutes(touch.clientY)

      // Store pending drag info — only activate after hold
      dragRef.current = {
        eventId, zone,
        startY: touch.clientY,
        origStart: sMins, origEnd: eMins,
        offset: touchMins - sMins,
        moved: false,
        ready: false,
        cancelled: false,
        timer: setTimeout(() => {
          const dr = dragRef.current
          if (dr && !dr.cancelled) {
            dr.ready = true
            setDragReady({ id: eventId, zone })
          }
        }, 350),
      }
    },
    [events, gridMinutes]
  )

  const onDragMove = useCallback(
    (e) => {
      const dr = dragRef.current
      if (!dr) return
      const touch = e.touches[0]
      // If not yet ready (still holding), cancel if finger moves
      if (!dr.ready) {
        if (Math.abs(touch.clientY - dr.startY) > 8) {
          clearTimeout(dr.timer)
          dr.cancelled = true
          dragRef.current = null
          setDragReady(null)
        }
        return
      }
      if (!dr.moved && Math.abs(touch.clientY - dr.startY) < 5) return
      if (!dr.moved) {
        dr.moved = true
        setDragReady(null)
        setDragId(dr.eventId)
        setDragZone(dr.zone)
      }
      e.preventDefault()

      // Auto-scroll when dragging near edges of the grid
      const grid = hourGridRef.current
      if (grid) {
        const rect = grid.getBoundingClientRect()
        const edgeZone = 40
        const scrollSpeed = 4
        if (touch.clientY - rect.top < edgeZone) {
          grid.scrollTop = Math.max(0, grid.scrollTop - scrollSpeed)
        } else if (rect.bottom - touch.clientY < edgeZone) {
          grid.scrollTop = grid.scrollTop + scrollSpeed
        }
      }

      const mins = gridMinutes(touch.clientY)
      const { zone, origStart, origEnd, offset } = dr
      const duration = origEnd - origStart
      let s, en

      if (zone === 'move') {
        s = Math.max(0, mins - offset)
        en = s + duration
        if (en > 24 * 60) { en = 24 * 60; s = en - duration }
      } else if (zone === 'resize-top') {
        s = Math.max(0, Math.min(mins, origEnd - 15))
        en = origEnd
      } else {
        s = origStart
        en = Math.max(origStart + 15, Math.min(mins, 24 * 60))
      }

      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === dr.eventId
            ? { ...ev, time: minutesToTime(s), endTime: minutesToTime(en) }
            : ev
        )
      )
    },
    [gridMinutes, setEvents]
  )

  const endDrag = useCallback(() => {
    const dr = dragRef.current
    if (dr?.timer) clearTimeout(dr.timer)
    if (dr?.moved) {
      const ev = events.find((x) => x.id === dr.eventId)
      if (ev?.recurrence && ev.recurrence !== 'none') {
        setRepeatPrompt({
          eventId: dr.eventId,
          origStart: dr.origStart,
          origEnd: dr.origEnd,
        })
      }
    }
    dragRef.current = null
    setDragReady(null)
    setDragId(null)
    setDragZone(null)
  }, [events])

  useEffect(() => {
    const mv = (e) => onDragMove(e)
    const up = () => endDrag()
    document.addEventListener('touchmove', mv, { passive: false })
    document.addEventListener('touchend', up)
    document.addEventListener('touchcancel', up)
    return () => {
      document.removeEventListener('touchmove', mv)
      document.removeEventListener('touchend', up)
      document.removeEventListener('touchcancel', up)
    }
  }, [onDragMove, endDrag])

  // Month navigation
  const prevMonth = () => setViewMonth((m) => subMonths(m, 1))
  const nextMonth = () => setViewMonth((m) => addMonths(m, 1))
  const goToday = () => {
    setViewMonth(startOfMonth(new Date()))
    setCurrentDate(startOfDay(new Date()))
  }

  // ---- Build day view ----
  const dayEvents = eventsOn(currentDate)
  const allDayEvents = dayEvents.filter((e) => !e.time)
  const timedEvents = dayEvents.filter((e) => e.time)
  const showNow = isToday(currentDate)
  const nowTop = (nowMins / 60) * hourHeight

  // Compute overlap layout
  const layout = useMemo(() => computeLayout(timedEvents, dragId), [timedEvents, dragId])

  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [pickerMonth, setPickerMonth] = useState(viewMonth)
  const [showAllTasks, setShowAllTasks] = useState(false)
  const pickerSwipeRef = useRef(null)

  // Sync picker month when opening
  useEffect(() => {
    if (showMonthPicker) setPickerMonth(viewMonth)
  }, [showMonthPicker])

  // Build mini calendar grid for pickerMonth
  const pickerDays = useMemo(() => {
    const first = startOfMonth(pickerMonth)
    const last = endOfMonth(pickerMonth)
    const startDow = getDay(first) // 0=Sun
    const allDays = eachDayOfInterval({ start: first, end: last })
    // Pad start with nulls for alignment
    const padded = Array.from({ length: startDow }, () => null).concat(allDays)
    return padded
  }, [pickerMonth])

  return (
    <div className="page">
      {/* Date header */}
      <PageBanner bannerRef={bannerRef}>
        <div className="calendar-banner-row">
          <div className="cal-menu-wrap" ref={calMenuRef}>
            <button className="cal-dots-btn" onClick={() => { setShowCalendarPicker(!showCalendarPicker); setShowNewCalInput(false); setNewCalName('') }} aria-label="Switch calendar">
              <span className="cal-dot-icon" /><span className="cal-dot-icon" /><span className="cal-dot-icon" />
            </button>
            {showCalendarPicker && (
              <>
              <div className="cal-menu-backdrop" onClick={() => { setShowCalendarPicker(false); setShowNewCalInput(false); setNewCalName('') }} />
              <div className="cal-menu">
                {calendars.map((cal) => (
                  <button
                    key={cal.id}
                    className={`cal-menu-item${activeCalendarId === cal.id ? ' active' : ''}`}
                    onClick={() => { setActiveCalendarId(cal.id); setShowCalendarPicker(false) }}
                  >
                    <span>{cal.name}</span>
                    {activeCalendarId === cal.id && <span className="cal-check">✓</span>}
                  </button>
                ))}
                {showNewCalInput ? (
                  <form className="cal-menu-new-form" onSubmit={(e) => {
                    e.preventDefault()
                    if (!newCalName.trim()) return
                    const newCal = { id: uuid(), name: newCalName.trim() }
                    setCalendars((prev) => [...prev, newCal])
                    setActiveCalendarId(newCal.id)
                    setShowCalendarPicker(false)
                    setShowNewCalInput(false)
                    setNewCalName('')
                  }}>
                    <input
                      className="cal-menu-new-input"
                      value={newCalName}
                      onChange={(e) => setNewCalName(e.target.value)}
                      placeholder="Calendar name"
                      autoFocus
                    />
                    <button type="submit" className="cal-menu-new-ok">✓</button>
                  </form>
                ) : (
                  <button className="cal-menu-item cal-menu-add" onClick={() => setShowNewCalInput(true)}>
                    <span>+</span><span>New calendar</span>
                  </button>
                )}
              </div>
              </>
            )}
          </div>
          <h1 className="banner-date-center">{format(currentDate, 'MMM d, yyyy')}<button className="banner-caret-btn" onClick={(e) => { e.stopPropagation(); setShowMonthPicker(!showMonthPicker) }} aria-label="Choose month"><span className={`banner-caret${showMonthPicker ? ' open' : ''}`}>›</span></button></h1>
          <button className="btn-today" onClick={goToday} aria-label="Go to today">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="17" rx="1" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="8" y1="2" x2="8" y2="5" />
              <line x1="16" y1="2" x2="16" y2="5" />
              <circle cx="12" cy="15" r="2" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>
        {calendars.length > 1 && (
          <div className="cal-name-strip">
            {(calendars.find((c) => c.id === activeCalendarId) || calendars[0]).name}
          </div>
        )}
      </PageBanner>

      {showMonthPicker && (
        <div className="month-dropdown-overlay" onClick={() => setShowMonthPicker(false)} />
      )}
      {showMonthPicker && (
        <div className="month-dropdown" onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => {
            pickerSwipeRef.current = { startX: e.touches[0].clientX }
          }}
          onTouchEnd={(e) => {
            const sw = pickerSwipeRef.current
            if (!sw) return
            const dx = e.changedTouches[0].clientX - sw.startX
            if (dx > 50) setPickerMonth((m) => subMonths(m, 1))
            else if (dx < -50) setPickerMonth((m) => addMonths(m, 1))
            pickerSwipeRef.current = null
          }}
        >
          <div className="month-dropdown-header">
            <button className="month-arrow" onClick={() => setPickerMonth((m) => subMonths(m, 1))} aria-label="Previous month">‹</button>
            <span className="month-dropdown-year">{format(pickerMonth, 'MMMM yyyy')}</span>
            <button className="month-arrow" onClick={() => setPickerMonth((m) => addMonths(m, 1))} aria-label="Next month">›</button>
          </div>
          <div className="mini-cal-weekdays">
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <span key={i} className="mini-cal-weekday">{d}</span>
            ))}
          </div>
          <div className="mini-cal-grid">
            {pickerDays.map((d, i) => (
              d ? (
                <button
                  key={i}
                  className={`mini-cal-day${isSameDay(d, currentDate) ? ' active' : ''}${isToday(d) ? ' today' : ''}`}
                  onClick={() => {
                    setCurrentDate(startOfDay(d))
                    setViewMonth(startOfMonth(d))
                    setShowMonthPicker(false)
                  }}
                >
                  {format(d, 'd')}
                </button>
              ) : <span key={i} className="mini-cal-day empty" />
            ))}
          </div>
        </div>
      )}

      {/* Day strip */}
      <div className="day-strip" ref={stripRef}>
        {days.map((d, i) => {
          const active = isSameDay(d, currentDate)
          const today = isToday(d)
          const shaded = i % 2 === 0
          const outOfMonth = getMonth(d) !== getMonth(viewMonth)
          return (
            <button
              key={d.toISOString()}
              ref={active ? activeRef : null}
              className={`day-strip-item${active ? ' active' : ''}${today ? ' is-today' : ''}${shaded ? ' shaded' : ''}${outOfMonth ? ' out-of-month' : ''}`}
              onClick={() => {
                setCurrentDate(d)
                if (getMonth(d) !== getMonth(viewMonth)) {
                  setViewMonth(startOfMonth(d))
                }
              }}
            >
              <span className="strip-day-name">{format(d, 'EEE')}</span>
              <span className="strip-day-num">{format(d, 'd')}</span>
            </button>
          )
        })}
      </div>
      <div className="day-strip-push" />

      {allDayEvents.length > 0 && (() => {
        const visible = showAllTasks ? allDayEvents : allDayEvents.slice(0, 3)
        return (
          <div className="pinned-tasks" ref={pinnedRef}>
            {visible.map((ev) => {
              const t = getEventType(ev.type, eventTypes)
              return (
                <div key={ev.id} className="pinned-task-row" style={{ borderLeftColor: t.color, cursor: 'pointer' }} onClick={() => openEditModal(ev)}>
                  {ev.type === 'task' && (() => {
                    const missed = !ev.done && !isToday(currentDate) && isBefore(currentDate, new Date())
                    return (
                      <span className={`task-check${ev.done ? ' done' : missed ? ' missed' : ''}`} onClick={(e) => toggleTaskDone(ev.id, e)}>
                        {ev.done ? '✓' : ''}
                      </span>
                    )
                  })()}
                  {/\b(homework|hw)\b/i.test(ev.title) ? (
                    <span className={`pinned-task-title${ev.done ? ' task-done-text' : ''}`} dangerouslySetInnerHTML={{ __html: ev.title.replace(/\b(homework|hw)\b/gi, '<strong>$1</strong>') }} />
                  ) : (
                    <span className={`pinned-task-title${ev.done ? ' task-done-text' : ''}`}>{ev.title}</span>
                  )}
                  <button className="chip-delete" onClick={(e) => handleDelete(ev.id, e)}>✕</button>
                </div>
              )
            })}
            {allDayEvents.length > 3 && (
              <button className="pinned-tasks-toggle" onClick={() => setShowAllTasks(!showAllTasks)}>
                {showAllTasks ? 'Show less' : `See more (${allDayEvents.length - 3})`}
              </button>
            )}
          </div>
        )
      })()}
      {allDayEvents.length > 0 && <div className="pinned-tasks-push" style={{ height: `${Math.min(showAllTasks ? allDayEvents.length : 3, allDayEvents.length) * 22 + (allDayEvents.length > 3 ? 24 : 0) + 12}px` }} />}

      {/* Day schedule */}
      <div
        className="day-schedule"
        ref={scheduleRef}
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
        onTouchCancel={handleSwipeEnd}
      >

        <div
          className="hour-grid"
          ref={hourGridRef}
          onClick={handleGridClick}
          onTouchStart={handleGridTouchStart}
          onTouchEnd={handleGridTouchEnd}
        >
          {HOURS.map((h) => (
            <div key={h} className="hour-row" style={{ height: `${hourHeight}px` }}>
              <span className="hour-label">{formatHour(h)}</span>
            </div>
          ))}
          <div className="hour-row" style={{ minHeight: 0 }}>
            <span className="hour-label">12:00 AM</span>
          </div>

          {showNow && (
            <div className="now-line" style={{ top: `${nowTop}px` }}>
              <div className="now-dot" />
              <div className="now-rule" />
            </div>
          )}

          {draft && (() => {
            const dTop = (draft.start / 60) * hourHeight
            const dHeight = Math.max(20, ((draft.end - draft.start) / 60) * hourHeight)
            return (
              <div
                className="draft-event"
                style={{ top: `${dTop}px`, height: `${dHeight}px` }}
                onClick={(e) => { e.stopPropagation(); handleDraftTap() }}
                onTouchStart={(e) => {
                  // Body drag — but not if touching a handle
                  if (e.target.closest('.draft-handle') || e.target.closest('.draft-dismiss')) return
                  startDraftDrag(e, 'body')
                }}
              >
                <div
                  className="draft-handle draft-handle-top"
                  onTouchStart={(e) => startDraftDrag(e, 'top')}
                />
                <button className="draft-dismiss" onClick={(e) => { e.stopPropagation(); dismissDraft() }}>✕</button>
                <span className="draft-event-label">New event</span>
                <span className="draft-event-time">{displayTime(draft.start)} – {displayTime(draft.end)}</span>
                <div
                  className="draft-handle draft-handle-bottom"
                  onTouchStart={(e) => startDraftDrag(e, 'bottom')}
                />
              </div>
            )
          })()}

          {/* Timed events — absolutely positioned with overlap columns */}
          {timedEvents.map((ev) => {
            const t = getEventType(ev.type, eventTypes)
            const sMins = timeToMinutes(ev.time)
            const isTaskEv = ev.type === 'task'
            const eMins = ev.endTime ? timeToMinutes(ev.endTime) : sMins + (isTaskEv ? 15 : 60)
            const top = (sMins / 60) * hourHeight
            const height = isTaskEv ? TASK_HEIGHT : Math.max(((eMins - sMins) / 60) * hourHeight, 28)
            const dragging = dragId === ev.id
            const ready = dragReady?.id === ev.id
            const readyZone = dragReady?.zone
            const { col = 0, totalCols = 1 } = layout.get(ev.id) || {}

            return (
              <div
                key={ev.id}
                className={`cal-event${dragging ? ' dragging' : ''}${ready ? ` drag-ready drag-ready-${readyZone}` : ''}`}
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${col / totalCols})`,
                  width: `calc((100% - ${LABEL_W}px) * ${1 / totalCols})`,
                  right: 'auto',
                  zIndex: dragging ? 50 : undefined,
                  background: tintColor(t.color),
                  borderColor: `${t.color}30`,
                }}
                onTouchStart={(e) => startDrag(e, ev.id)}
                onClick={(e) => { e.stopPropagation(); openEditModal(ev) }}
              >
                {dragging && (dragZone === 'resize-top' || dragZone === 'move') && (
                  <div className="drag-handle drag-handle-top" />
                )}
                <div className="cal-event-strip" style={{ background: t.color }} />
                <div className={`cal-event-body${totalCols > 1 ? ' stacked' : ''}`}>
                  {ev.type === 'task' && (() => {
                    const taskMissed = !ev.done && (isBefore(currentDate, startOfDay(new Date())) || (isToday(currentDate) && sMins < nowMins))
                    return (
                      <span className={`task-check${ev.done ? ' done' : taskMissed ? ' missed' : ''}`} onClick={(e) => { e.stopPropagation(); toggleTaskDone(ev.id, e) }}>
                        {ev.done ? '✓' : ''}
                      </span>
                    )
                  })()}
                  {ev.goalId && ev.type !== 'task' && (() => {
                    const dateStr = startOfDay(currentDate).toISOString()
                    const confirmed = (ev.confirmedDates || []).includes(dateStr)
                    const evMissed = !confirmed && (isBefore(currentDate, startOfDay(new Date())) || (isToday(currentDate) && eMins < nowMins))
                    return (
                      <span className={`task-check${confirmed ? ' done' : evMissed ? ' missed' : ''}`} onClick={(e) => toggleEventConfirmed(ev.id, currentDate, e)}>
                        {confirmed ? '✓' : ''}
                      </span>
                    )
                  })()}
                  {/\b(homework|hw)\b/i.test(ev.title) ? (
                    <span className={`cal-event-title${ev.done ? ' task-done-text' : ''}`} dangerouslySetInnerHTML={{ __html: ev.title.replace(/\b(homework|hw)\b/gi, '<strong>$1</strong>') }} />
                  ) : (
                    <span className={`cal-event-title${ev.done ? ' task-done-text' : ''}`}>{ev.title}</span>
                  )}
                  <span className="cal-event-time">{displayTime(sMins)}{ev.endTime ? ` – ${displayTime(eMins)}` : ''}</span>
                  {ev.recurrence && ev.recurrence !== 'none' && (
                    <span className="cal-event-repeat">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                        <polyline points="17 1 21 5 17 9" />
                        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                        <polyline points="7 23 3 19 7 15" />
                        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                      </svg>
                    </span>
                  )}
                </div>
                {dragging && (dragZone === 'resize-bottom' || dragZone === 'move') && (
                  <div className="drag-handle drag-handle-bottom" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal */}
      {showForm && selectedDate && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {step === 'pick-type' ? (
              <>
                <h2>New Event — {format(selectedDate, 'MMM d, yyyy')}</h2>
                <p className="muted" style={{ marginBottom: 12 }}>What type of event?</p>
                <div className="type-list">
                  {eventTypes.map((t) => (
                    <button key={t.id} className="type-list-item" onClick={() => handleTypeSelect(t.id)}>
                      <span className="type-dot" style={{ background: t.color }} />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
                <div className="form-actions" style={{ marginTop: 16 }}>
                  <button onClick={() => setShowForm(false)}>Cancel</button>
                </div>
              </>
            ) : (
              <form onSubmit={handleAdd}>
                <div className="modal-type-tag" style={{ background: getEventType(selectedType, eventTypes).color, color: '#fff' }}>
                  {getEventType(selectedType, eventTypes).label}
                </div>
                <h2>Add Event</h2>
                <label>
                  Title
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </label>
                <label>
                  Notes (optional)
                  <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                </label>
                {isTask ? (
                  <div className="optional-time-section">
                    <label className="time-toggle-label">
                      <span>Time</span>
                      <span className="time-toggle-right">
                        <input type="checkbox" checked={!!form.time} onChange={(e) => {
                          if (e.target.checked) {
                            const now = new Date()
                            const h = String(now.getHours()).padStart(2, '0')
                            const m = String(Math.round(now.getMinutes() / 15) * 15 % 60).padStart(2, '0')
                            setForm({ ...form, time: `${h}:${m}` })
                          } else {
                            setForm({ ...form, time: '' })
                          }
                        }} />
                      </span>
                    </label>
                    {form.time && (
                      <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                    )}
                  </div>
                ) : (
                  <div className="time-row">
                    <label>
                      Start
                      <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
                    </label>
                    <label>
                      End
                      <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
                    </label>
                  </div>
                )}
                <label>
                  Repeat
                  <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
                    {RECURRENCE_OPTIONS.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </label>
                {form.recurrence === 'custom' && (
                  <div className="custom-recurrence">
                    <div className="custom-row">
                      <span>Every</span>
                      <input type="number" min="1" value={form.customEvery} onChange={(e) => setForm({ ...form, customEvery: e.target.value })} className="custom-num" />
                      <select value={form.customUnit} onChange={(e) => setForm({ ...form, customUnit: e.target.value })}>
                        <option value="days">days</option>
                        <option value="weeks">weeks</option>
                        <option value="months">months</option>
                      </select>
                    </div>
                    {form.customUnit === 'weeks' && (
                      <div className="custom-days">
                        {DAY_LABELS.map((label, idx) => (
                          <button key={idx} type="button" className={`day-btn${form.customDays.includes(idx) ? ' selected' : ''}`} onClick={() => toggleCustomDay(idx)}>{label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {form.recurrence !== 'none' && (
                  <div className="end-repeat-section">
                    <span className="end-repeat-label">End repeat (optional)</span>
                    <div className="end-repeat-row">
                      <input type="date" value={form.recurrenceEnd} onChange={(e) => setForm({ ...form, recurrenceEnd: e.target.value })} />
                      {form.recurrenceEnd && (
                        <button type="button" className="btn-clear" onClick={(e) => { e.stopPropagation(); setForm({ ...form, recurrenceEnd: '' }) }}>Clear</button>
                      )}
                    </div>
                  </div>
                )}
                <div className="form-actions">
                  <button type="submit" className="btn-primary">Add Event</button>
                  <button type="button" onClick={() => setStep('pick-type')}>Back</button>
                  <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit event modal */}
      {editingEvent && (
        <div className="modal-overlay" onClick={() => setEditingEvent(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleEditSave}>
            <div className="modal-type-tag" style={{ background: getEventType(editingEvent.type, eventTypes).color, color: '#fff' }}>
              {getEventType(editingEvent.type, eventTypes).label}
            </div>
            <h2>Edit Event</h2>
            <label>
              Title
              <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required />
            </label>
            <label>
              Notes
              <textarea rows={2} value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
            </label>
            {editingEvent.type === 'task' ? (
              <div className="optional-time-section">
                <label className="time-toggle-label">
                  <span>Time</span>
                  <span className="time-toggle-right">
                    <input type="checkbox" checked={!!editForm.time} onChange={(e) => {
                      if (e.target.checked) {
                        const now = new Date()
                        const h = String(now.getHours()).padStart(2, '0')
                        const m = String(Math.round(now.getMinutes() / 15) * 15 % 60).padStart(2, '0')
                        setEditForm({ ...editForm, time: `${h}:${m}` })
                      } else {
                        setEditForm({ ...editForm, time: '' })
                      }
                    }} />
                  </span>
                </label>
                {editForm.time && (
                  <input type="time" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} />
                )}
              </div>
            ) : (
              <div className="time-row">
                <label>
                  Start
                  <input type="time" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} required />
                </label>
                <label>
                  End
                  <input type="time" value={editForm.endTime} onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} required />
                </label>
              </div>
            )}
            <div className="form-actions">
              <button type="submit" className="btn-primary">Save</button>
              <button type="button" className="btn-danger" onClick={handleEditDelete}>Delete</button>
              <button type="button" onClick={() => setEditingEvent(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Repeat drag prompt */}
      {repeatPrompt && (
        <div className="modal-overlay" onClick={() => {
          setEvents((prev) =>
            prev.map((ev) =>
              ev.id === repeatPrompt.eventId
                ? { ...ev, time: minutesToTime(repeatPrompt.origStart), endTime: minutesToTime(repeatPrompt.origEnd) }
                : ev
            )
          )
          setRepeatPrompt(null)
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Repeating Event</h2>
            <p style={{ marginBottom: 16 }}>Apply this time change to:</p>
            <div className="form-actions">
              <button className="btn-primary" onClick={() => setRepeatPrompt(null)}>
                All occurrences
              </button>
              <button onClick={() => {
                // Save override for just this date, revert the base event
                const { eventId, origStart, origEnd } = repeatPrompt
                const dateKey = format(currentDate, 'yyyy-MM-dd')
                setEvents((prev) =>
                  prev.map((ev) => {
                    if (ev.id !== eventId) return ev
                    const newTime = ev.time
                    const newEnd = ev.endTime
                    const overrides = { ...(ev.overrides || {}) }
                    overrides[dateKey] = { ...(overrides[dateKey] || {}), time: newTime, endTime: newEnd }
                    return { ...ev, time: minutesToTime(origStart), endTime: minutesToTime(origEnd), overrides }
                  })
                )
                setRepeatPrompt(null)
              }}>
                Only this one
              </button>
              <button onClick={() => {
                setEvents((prev) =>
                  prev.map((ev) =>
                    ev.id === repeatPrompt.eventId
                      ? { ...ev, time: minutesToTime(repeatPrompt.origStart), endTime: minutesToTime(repeatPrompt.origEnd) }
                      : ev
                  )
                )
                setRepeatPrompt(null)
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit repeat prompt */}
      {editRepeatPrompt && (
        <div className="modal-overlay" onClick={() => setEditRepeatPrompt(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Repeating Event</h2>
            {editRepeatPrompt.deleteMode ? (
              <>
                <p style={{ marginBottom: 16 }}>Delete this event for:</p>
                <div className="form-actions">
                  <button className="btn-danger" onClick={deleteEditAll}>All occurrences</button>
                  <button className="btn-danger" onClick={deleteEditThisOnly}>Only this one</button>
                  <button onClick={() => setEditRepeatPrompt(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ marginBottom: 16 }}>Apply changes to:</p>
                <div className="form-actions">
                  <button className="btn-primary" onClick={applyEditAll}>All occurrences</button>
                  <button onClick={applyEditThisOnly}>Only this one</button>
                  <button onClick={() => setEditRepeatPrompt(null)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <button className="cal-fab" onClick={() => { setDraft(null); openModal(currentDate, nowMinutes(), null, true) }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  )
}
