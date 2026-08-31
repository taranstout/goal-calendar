export const DEFAULT_EVENT_TYPES = [
  { id: 'task',       label: 'Task',        color: '#f97316' },
  { id: 'personal',   label: 'Personal',    color: '#6366f1' },
  { id: 'work',       label: 'Work',        color: '#3b82f6' },
  { id: 'exercise',   label: 'Exercise',    color: '#22c55e' },
  { id: 'social',     label: 'Social',      color: '#f59e0b' },
  { id: 'health',     label: 'Health',      color: '#ef4444' },
  { id: 'learning',   label: 'Learning',    color: '#8b5cf6' },
  { id: 'errand',     label: 'Errand',      color: '#ec4899' },
  { id: 'exam',        label: 'Exam',        color: '#dc2626', starred: true },
  { id: 'other',      label: 'Other',       color: '#6b7280' },
]

export function getEventType(id, eventTypes) {
  const types = eventTypes || DEFAULT_EVENT_TYPES
  return types.find((t) => t.id === id) || types[types.length - 1] || DEFAULT_EVENT_TYPES[DEFAULT_EVENT_TYPES.length - 1]
}
