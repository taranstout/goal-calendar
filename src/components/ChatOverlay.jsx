import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { sendToGemini, buildContext } from '../utils/gemini'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { startOfDay } from 'date-fns'

export default function ChatOverlay({ open, onClose, events, setEvents, goals, setGoals, notes, setNotes, eventTypes, calendars }) {
  const [apiKey] = useLocalStorage('geminiApiKey', '')
  const [messages, setMessages] = useLocalStorage('chatMessages', [])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' })
        inputRef.current?.focus()
      }, 50)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const executeAction = (action) => {
    const { name, args } = action
    switch (name) {
      case 'add_event': {
        const dateObj = startOfDay(new Date(args.date + 'T00:00:00'))
        const newEvent = {
          id: uuid(),
          title: args.title,
          type: args.type || 'task',
          date: dateObj.toISOString(),
          time: args.time || '',
          endTime: args.endTime || '',
          note: args.note || '',
          recurrence: args.recurrence || 'none',
          recurrenceEnd: args.recurrenceEnd || null,
          goalId: null,
          confirmedDates: [],
          calendarId: args.calendarId || 'default',
        }
        setEvents((prev) => [...prev, newEvent])
        return `Added "${args.title}" on ${args.date}`
      }
      case 'mark_task_done': {
        let found = false
        setEvents((prev) => prev.map((ev) => {
          if (ev.id === args.id) { found = true; return { ...ev, done: true } }
          return ev
        }))
        return found ? 'Marked task as done' : 'Task not found'
      }
      case 'delete_event': {
        let found = false
        setEvents((prev) => {
          const filtered = prev.filter((ev) => ev.id !== args.id)
          found = filtered.length < prev.length
          return filtered
        })
        return found ? 'Deleted event' : 'Event not found'
      }
      case 'add_note': {
        const newNote = {
          id: uuid(),
          title: args.title || '',
          body: args.body || '',
          createdAt: new Date().toISOString(),
        }
        setNotes((prev) => [...prev, newNote])
        return `Added note "${args.title}"`
      }
      case 'add_goal': {
        const newGoal = {
          id: uuid(),
          name: args.name,
          target: args.target,
          frequency: args.frequency,
          display: 'bar',
          icon: 'target',
          progress: {},
          createdAt: new Date().toISOString(),
        }
        setGoals((prev) => [...prev, newGoal])
        return `Added goal "${args.name}"`
      }
      default:
        return 'Unknown action'
    }
  }

  if (!open) return null

  const send = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg = { role: 'user', text: input.trim(), ts: Date.now() }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const context = buildContext(events, goals, notes, eventTypes, calendars)
      const result = await sendToGemini(apiKey, updated, context)

      const actionResults = result.actions.map((a) => executeAction(a))

      let replyText = result.text || ''
      if (actionResults.length > 0 && !replyText) {
        replyText = actionResults.join('. ')
      }

      setMessages((prev) => [...prev, { role: 'assistant', text: replyText || 'Done!', ts: Date.now() }])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
    setError(null)
  }

  if (!apiKey) {
    return (
      <div className="chat-overlay">
        <div className="chat-overlay-header">
          <h2>AI Assistant</h2>
          <button className="chat-overlay-close" onClick={onClose}>✕</button>
        </div>
        <div className="chat-messages">
          <div className="chat-empty">
            <p style={{ marginBottom: 12 }}>Add your Gemini API key in Settings to use the AI assistant.</p>
            <button className="btn-primary" onClick={() => { onClose(); navigate('/settings') }}>Go to Settings</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-overlay">
      <div className="chat-overlay-header">
        <h2>AI Assistant</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {messages.length > 0 && (
            <button className="chat-clear" onClick={clearChat}>Clear</button>
          )}
          <button className="chat-overlay-close" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p className="muted">Ask me anything about your schedule, goals, or notes — or ask me to make changes.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.role}`}>
            <div className="chat-bubble-text">{msg.text}</div>
          </div>
        ))}
        {loading && (
          <div className="chat-bubble assistant">
            <div className="chat-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        {error && (
          <div className="chat-error">{error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input-bar" onSubmit={send}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()} className="chat-send">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  )
}
