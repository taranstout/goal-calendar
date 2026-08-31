import { useEffect } from 'react'
import { format } from 'date-fns'
import PageBanner from '../components/PageBanner'

export default function Notes({ notes, setNotes }) {
  useEffect(() => { window.scrollTo(0, 0) }, [])

  const deleteNote = (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  const sorted = [...notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return (
    <div className="page">
      <PageBanner><h1>Notes</h1></PageBanner>

      {sorted.length === 0 ? (
        <section className="card">
          <p className="muted">No notes yet. Tap the Quick Note button to add one.</p>
        </section>
      ) : (
        <div className="notes-list">
          {sorted.map((note) => (
            <div key={note.id} className="card note-card">
              <div className="note-header">
                <span className="note-title">{note.title || 'Untitled'}</span>
                <button className="btn-delete-sm" onClick={() => deleteNote(note.id)}>✕</button>
              </div>
              {note.body && (
                <p className="note-body">{note.body}</p>
              )}
              <span className="note-date">
                {format(new Date(note.createdAt), 'MMM d, yyyy · h:mm a')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
