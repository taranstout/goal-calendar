import React, { useState, useEffect, useRef } from 'react'
import { v4 as uuid } from 'uuid'
import { differenceInCalendarDays, format, startOfDay, addDays, isSameDay } from 'date-fns'
import { getPeriodKey, getCurrentProgress } from '../utils/goalPeriods'
import { eventOccursOn } from '../utils/recurrence'
import QuickNote from '../components/QuickNote'
import ChatOverlay from '../components/ChatOverlay'
import PageBanner from '../components/PageBanner'

function isHomework(title) {
  return /\b(homework|hw)\b/i.test(title)
}

function renderHomeworkTitle(title) {
  return title.replace(/\b(homework|hw)\b/gi, (match) => `**${match}**`)
}

const TABS = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'daily', label: 'Daily' },
  { id: 'monthly', label: 'Monthly' },
]

export default function Home({ goals, setGoals, events, setEvents, notes, setNotes, eventTypes = [], calendars = [] }) {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const [activeTab, setActiveTab] = useState('weekly')
  const [showForm, setShowForm] = useState(false)
  const [expandedTypes, setExpandedTypes] = useState({})
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)
  const longPressTimer = useRef(null)
  const swipeStartX = useRef(0)
  const swipeStartY = useRef(0)
  const swiping = useRef(false)
  const [form, setForm] = useState({ name: '', target: '' })

  const handleAdd = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setGoals((prev) => [
      ...prev,
      {
        id: uuid(),
        name: form.name.trim(),
        target: Number(form.target) || 1,
        frequency: activeTab,
        display: 'bar',
        icon: 'target',
        progress: {},
        createdAt: new Date().toISOString(),
      },
    ])
    setForm({ name: '', target: '' })
    setShowForm(false)
  }

  const increment = (id) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g
        const key = getPeriodKey(g.frequency || 'weekly')
        const progress = { ...(g.progress || {}) }
        progress[key] = Math.min((progress[key] || 0) + 1, g.target)
        return { ...g, progress }
      })
    )
  }

  const decrement = (id) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g
        const key = getPeriodKey(g.frequency || 'weekly')
        const progress = { ...(g.progress || {}) }
        progress[key] = Math.max((progress[key] || 0) - 1, 0)
        return { ...g, progress }
      })
    )
  }

  const deleteGoal = (id) => {
    setGoals((prev) => prev.filter((g) => g.id !== id))
  }

  const filtered = goals.filter((g) => (g.frequency || 'weekly') === activeTab)

  const renderGoalCard = (goal) => {
    const current = getCurrentProgress(goal)
    const pct = Math.round((current / goal.target) * 100)

    const startLongPress = () => {
      longPressTimer.current = setTimeout(() => setDeleteConfirm(goal.id), 500)
    }
    const cancelLongPress = () => {
      clearTimeout(longPressTimer.current)
    }

    const handleBarTap = (e) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX || e.changedTouches?.[0]?.clientX || 0
      if (x < rect.left + rect.width / 2) {
        decrement(goal.id)
      } else {
        increment(goal.id)
      }
    }

    return (
      <div
        key={goal.id}
        className="ki-card"
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        onContextMenu={(e) => { e.preventDefault(); setDeleteConfirm(goal.id) }}
      >
        <div className="ki-card-top">
          <div className="ki-bar-track" onClick={handleBarTap}>
            <div className="ki-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="ki-count">{current}/{goal.target}</span>
        </div>
        <span className="ki-title">{goal.name}</span>
      </div>
    )
  }

  return (
    <div className="page">
      <PageBanner><h1>Home</h1></PageBanner>

      <section className="card ki-section">
        <div className="ki-header">
          <span className="ki-label">KEY INDICATORS <span className="ki-separator">|</span> {activeTab.toUpperCase()}</span>
          <button className="ki-add-link" onClick={() => setShowForm(true)}>ADD NEW</button>
        </div>

        <div className="ki-divider" />

        <div
          className="ki-swipe"
          onTouchStart={(e) => {
            swipeStartX.current = e.touches[0].clientX
            swipeStartY.current = e.touches[0].clientY
            swiping.current = false
          }}
          onTouchMove={(e) => {
            const dx = Math.abs(e.touches[0].clientX - swipeStartX.current)
            const dy = Math.abs(e.touches[0].clientY - swipeStartY.current)
            if (dx > dy && dx > 20) swiping.current = true
          }}
          onTouchEnd={(e) => {
            if (!swiping.current) return
            const diff = e.changedTouches[0].clientX - swipeStartX.current
            const idx = TABS.findIndex((t) => t.id === activeTab)
            if (diff > 40 && idx > 0) setActiveTab(TABS[idx - 1].id)
            else if (diff < -40 && idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id)
          }}
        >
          <div className={`ki-grid${filtered.length === 1 ? ' ki-grid-single' : ''}`}>
            {filtered.map(renderGoalCard)}
          </div>
        </div>

        <div className="ki-dots">
          {TABS.map((t) => (
            <span key={t.id} className={`ki-dot${activeTab === t.id ? ' active' : ''}`} />
          ))}
        </div>
      </section>

      {(() => {
        const today = startOfDay(new Date())
        const tomorrow = addDays(today, 1)
        const hwEvents = events.filter((ev) =>
          (ev.calendarId || 'default') === 'default' && ev.type === 'task' && !ev.done && isHomework(ev.title)
        )
        const dueToday = hwEvents.filter((ev) => isSameDay(startOfDay(new Date(ev.date)), today))
        const dueTomorrow = hwEvents.filter((ev) => isSameDay(startOfDay(new Date(ev.date)), tomorrow))

        return (
          <section className="card">
            <div className="ki-header">
              <span className="ki-label">ASSIGNMENTS DUE</span>
            </div>
            <div className="ki-divider" />
            {dueToday.length === 0 && dueTomorrow.length === 0 ? (
              <p className="muted small" style={{ padding: '8px 0' }}>No assignments due</p>
            ) : (
              <div className="hw-list">
                {dueToday.length > 0 && (
                  <>
                    <span className="hw-day-label">Today</span>
                    {dueToday.map((ev) => (
                      <div key={ev.id} className="hw-row">
                        <span className="hw-title" dangerouslySetInnerHTML={{ __html: ev.title.replace(/\b(homework|hw)\b/gi, '<strong>$1</strong>') }} />
                      </div>
                    ))}
                  </>
                )}
                {dueTomorrow.length > 0 && (
                  <>
                    <span className="hw-day-label">Tomorrow</span>
                    {dueTomorrow.map((ev) => (
                      <div key={ev.id} className="hw-row">
                        <span className="hw-title" dangerouslySetInnerHTML={{ __html: ev.title.replace(/\b(homework|hw)\b/gi, '<strong>$1</strong>') }} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </section>
        )
      })()}

      {(() => {
        const today = startOfDay(new Date())
        const starredTypes = eventTypes.filter((t) => t.starred)

        return starredTypes.map((type) => {
          const upcoming = events
            .filter((ev) => (ev.calendarId || 'default') === 'default' && ev.type === type.id)
            .map((ev) => ({ ...ev, eventDate: startOfDay(new Date(ev.date)) }))
            .filter((ev) => ev.eventDate >= today)
            .sort((a, b) => a.eventDate - b.eventDate)
          const expanded = expandedTypes[type.id]
          const visible = expanded ? upcoming : upcoming.slice(0, 3)

          return (
            <section className="card" key={type.id}>
              <div className="ki-header">
                <span className="ki-label">UPCOMING {type.label.toUpperCase()}</span>
              </div>
              <div className="ki-divider" />
              {upcoming.length === 0 ? (
                <p className="muted small" style={{ padding: '8px 0' }}>No upcoming {type.label.toLowerCase()}</p>
              ) : (
                <>
                  <div className="exam-list">
                    {visible.map((ev) => {
                      const days = differenceInCalendarDays(ev.eventDate, today)
                      return (
                        <div key={ev.id} className="exam-row">
                          <div className="exam-info">
                            <span className="exam-name">{ev.title}</span>
                            <span className="exam-date">{format(ev.eventDate, 'EEE, MMM d')}{ev.time ? ` · ${ev.time}` : ''}</span>
                          </div>
                          <span className={`exam-days${days <= (type.alertDays || 10) ? ' urgent' : ''}`}>
                            {days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  {upcoming.length > 3 && (
                    <button className="ki-add-link exam-toggle" onClick={() => setExpandedTypes((prev) => ({ ...prev, [type.id]: !prev[type.id] }))}>
                      {expanded ? 'SHOW LESS' : 'SEE MORE'}
                    </button>
                  )}
                </>
              )}
            </section>
          )
        })
      })()}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleAdd}>
            <h2>New Goal</h2>
            <label>
              Title
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Exercise, Read, Meditate"
                autoFocus
                required
              />
            </label>
            <label>
              Target
              <input
                type="number"
                min="1"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                placeholder="e.g. 5"
                required
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="btn-primary">Create</button>
              <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete this goal?</h2>
            <p style={{ color: 'var(--text)', marginBottom: 16 }}>This can't be undone.</p>
            <div className="form-actions">
              <button className="btn-danger" onClick={() => { deleteGoal(deleteConfirm); setDeleteConfirm(null) }}>Delete</button>
              <button onClick={() => setDeleteConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <QuickNote onSave={(note) => setNotes((prev) => [...prev, note])} onOpenChat={() => setChatOpen(true)} />

      <ChatOverlay open={chatOpen} onClose={() => setChatOpen(false)} events={events} setEvents={setEvents} goals={goals} setGoals={setGoals} notes={notes} setNotes={setNotes} eventTypes={eventTypes} calendars={calendars} />
    </div>
  )
}
