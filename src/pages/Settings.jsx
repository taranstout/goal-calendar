import { useState, useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { requestNotificationPermission, getNotificationPermission } from '../utils/notifications'
import { useLocalStorage } from '../hooks/useLocalStorage'
import PageBanner from '../components/PageBanner'

const TYPE_COLORS = [
  '#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#f97316',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6b7280',
  '#0ea5e9', '#a855f7', '#d946ef', '#84cc16', '#f43f5e',
]


export default function Settings({ dark, toggleTheme, eventTypes, setEventTypes, accentColor, setAccentColor, notifEnabled, setNotifEnabled, notifMinutes, setNotifMinutes }) {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ label: '', color: TYPE_COLORS[0] })
  const [editingId, setEditingId] = useState(null)
  const [showEventTypes, setShowEventTypes] = useState(false)
  const [geminiKey, setGeminiKey] = useLocalStorage('geminiApiKey', '')
  const [showKey, setShowKey] = useState(false)


  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)
  const dragY = useRef(0)
  const listRef = useRef(null)

  const handleDragStart = (idx, e) => {
    setDragIdx(idx)
    dragY.current = e.touches ? e.touches[0].clientY : e.clientY
  }

  const handleDragMove = (e) => {
    if (dragIdx === null) return
    e.preventDefault()
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const list = listRef.current
    if (!list) return
    const rows = list.querySelectorAll('.event-type-row')
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect()
      if (clientY >= rect.top && clientY <= rect.bottom) {
        setOverIdx(i)
        break
      }
    }
  }

  const handleDragEnd = () => {
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      setEventTypes((prev) => {
        const arr = [...prev]
        const [moved] = arr.splice(dragIdx, 1)
        arr.splice(overIdx, 0, moved)
        return arr
      })
    }
    setDragIdx(null)
    setOverIdx(null)
  }

  const openNew = () => {
    setEditingId(null)
    setForm({ label: '', color: TYPE_COLORS[0] })
    setShowForm(true)
  }

  const openEdit = (type) => {
    setEditingId(type.id)
    setForm({ label: type.label, color: type.color })
    setShowForm(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!form.label.trim()) return

    if (editingId) {
      setEventTypes((prev) =>
        prev.map((t) => t.id === editingId ? { ...t, label: form.label.trim(), color: form.color } : t)
      )
    } else {
      const id = form.label.trim().toLowerCase().replace(/\s+/g, '-') + '-' + uuid().slice(0, 4)
      setEventTypes((prev) => [...prev, { id, label: form.label.trim(), color: form.color }])
    }
    setShowForm(false)
  }

  const handleDelete = (id) => {
    setEventTypes((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="page">
      <PageBanner><h1>Settings</h1></PageBanner>

      <section className="card">
        <h2>Appearance</h2>
        <div className="setting-row">
          <span>Dark Mode</span>
          <button className="toggle-switch" onClick={toggleTheme} aria-label="Toggle dark mode">
            <span className={`toggle-track${dark ? ' on' : ''}`}>
              <span className="toggle-knob" />
            </span>
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Theme Color</h2>
        <div className="setting-row">
          <span>Theme Color</span>
          <input
            id="accent-picker"
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="accent-color-input"
          />
        </div>
      </section>

      <section className="card">
        <button className="settings-collapsible" onClick={() => setShowEventTypes(!showEventTypes)}>
          <h2>Event Types</h2>
          <span className={`settings-chevron${showEventTypes ? ' open' : ''}`}>›</span>
        </button>
        {showEventTypes && (
          <>
            <div
              className="event-type-list"
              ref={listRef}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
              onMouseMove={handleDragMove}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
            >
              {eventTypes.map((t, idx) => (
                <div key={t.id} className="event-type-group">
                  <div
                    className={`event-type-row${dragIdx === idx ? ' dragging' : ''}${overIdx === idx && dragIdx !== idx ? ' drag-over' : ''}`}
                  >
                    <span
                      className="drag-handle-icon"
                      onTouchStart={(e) => handleDragStart(idx, e)}
                      onMouseDown={(e) => handleDragStart(idx, e)}
                    >⠿</span>
                    <button
                      className={`btn-star${t.starred ? ' starred' : ''}`}
                      onClick={() => setEventTypes((prev) => prev.map((et) => et.id === t.id ? { ...et, starred: !et.starred } : et))}
                      aria-label="Toggle home screen tracking"
                    >★</button>
                    <span className="type-dot" style={{ background: t.color }} />
                    <span className="event-type-label">{t.label}</span>
                    <button className="btn-edit" onClick={() => openEdit(t)}>Edit</button>
                    <button className="btn-delete-sm" onClick={() => handleDelete(t.id)}>✕</button>
                  </div>
                  {t.starred && (
                    <div className="setting-row alert-days-row">
                      <span className="alert-days-label">Alert within</span>
                      <div className="stepper">
                        <button className="stepper-btn" onClick={() => setEventTypes((prev) => prev.map((et) => et.id === t.id ? { ...et, alertDays: Math.max(1, (et.alertDays || 10) - 1) } : et))}>−</button>
                        <span className="stepper-value">{t.alertDays || 10} {(t.alertDays || 10) === 1 ? 'day' : 'days'}</span>
                        <button className="stepper-btn" onClick={() => setEventTypes((prev) => prev.map((et) => et.id === t.id ? { ...et, alertDays: (et.alertDays || 10) + 1 } : et))}>+</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button className="btn-primary btn-sm" style={{ marginTop: 8 }} onClick={openNew}>+ New</button>
          </>
        )}
      </section>


      <section className="card">
        <h2>Notifications</h2>
        <div className="setting-row">
          <span>Event Reminders</span>
          <button
            className="toggle-switch"
            onClick={async () => {
              if (!notifEnabled) {
                const perm = await requestNotificationPermission()
                if (perm === 'granted') setNotifEnabled(true)
              } else {
                setNotifEnabled(false)
              }
            }}
            aria-label="Toggle notifications"
          >
            <span className={`toggle-track${notifEnabled ? ' on' : ''}`}>
              <span className="toggle-knob" />
            </span>
          </button>
        </div>
        {notifEnabled && (
          <div className="setting-row">
            <span>Remind me</span>
            <select
              value={notifMinutes}
              onChange={(e) => setNotifMinutes(Number(e.target.value))}
              className="notif-select"
            >
              <option value={5}>5 min before</option>
              <option value={10}>10 min before</option>
              <option value={15}>15 min before</option>
              <option value={30}>30 min before</option>
              <option value={60}>1 hour before</option>
            </select>
          </div>
        )}
        {getNotificationPermission() === 'denied' && (
          <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            Notifications are blocked. Enable them in your browser settings.
          </p>
        )}
      </section>

      <section className="card">
        <h2>AI Assistant</h2>
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <span>Gemini API Key</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="Paste your API key"
              style={{ flex: 1, fontSize: 13 }}
            />
            <button
              type="button"
              className="btn-sm"
              onClick={() => setShowKey(!showKey)}
              style={{ whiteSpace: 'nowrap' }}
            >{showKey ? 'Hide' : 'Show'}</button>
          </div>
          <p className="muted" style={{ fontSize: 11 }}>
            Get a free key at ai.google.dev
          </p>
        </div>
      </section>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
            <h2>{editingId ? 'Edit Event Type' : 'New Event Type'}</h2>
            <label>
              Name
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Meeting, Gym, Study"
                required
              />
            </label>
            <label>
              Color
              <div className="accent-picker-row" style={{ marginTop: 4 }}>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="accent-color-input"
                />
              </div>
            </label>
            <div className="form-actions">
              <button type="submit" className="btn-primary">{editingId ? 'Save' : 'Create'}</button>
              <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
