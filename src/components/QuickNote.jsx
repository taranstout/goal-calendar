import { useState } from 'react'
import { v4 as uuid } from 'uuid'

export default function QuickNote({ onSave, onOpenChat }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const handleSave = () => {
    if (!title.trim() && !body.trim()) return
    onSave({
      id: uuid(),
      title: title.trim(),
      body: body.trim(),
      createdAt: new Date().toISOString(),
    })
    setTitle('')
    setBody('')
    setNoteOpen(false)
  }

  const handleDiscard = () => {
    setTitle('')
    setBody('')
    setNoteOpen(false)
  }

  return (
    <>
      {!noteOpen && (
        <>
          {menuOpen && (
            <div className="fab-menu-overlay" onClick={() => setMenuOpen(false)} />
          )}
          <div className="fab-menu-container">
            {menuOpen && (
              <div className="fab-menu">
                <button className="fab-menu-item" onClick={() => { setMenuOpen(false); setNoteOpen(true) }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  <span>Quick Note</span>
                </button>
                <button className="fab-menu-item" onClick={() => { setMenuOpen(false); onOpenChat() }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span>AI Assistant</span>
                </button>
              </div>
            )}
            <button className="quick-note-fab" onClick={() => setMenuOpen(!menuOpen)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transition: 'transform .2s', transform: menuOpen ? 'rotate(45deg)' : 'none' }}>
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        </>
      )}

      {noteOpen && (
        <div className="modal-overlay" onClick={handleDiscard}>
          <div className="modal quick-note-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Quick Note</h2>
            <label>
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title"
                autoFocus
              />
            </label>
            <label>
              Body
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your note..."
                rows={4}
              />
            </label>
            <div className="form-actions">
              <button className="btn-primary" onClick={handleSave}>Save</button>
              <button onClick={handleDiscard}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
