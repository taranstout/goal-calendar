const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent'

const TOOLS = [
  {
    function_declarations: [
      {
        name: 'add_event',
        description: 'Add an event or task to the calendar',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Event title' },
            date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
            time: { type: 'string', description: 'Start time in HH:MM 24hr format, or empty for all-day' },
            endTime: { type: 'string', description: 'End time in HH:MM 24hr format, or empty' },
            type: { type: 'string', description: 'Event type id (e.g. "task", "exam", or a custom type id)' },
            note: { type: 'string', description: 'Optional note for the event' },
            recurrence: { type: 'string', enum: ['none', 'daily', 'weekly', 'monthly'], description: 'Recurrence rule. Defaults to none.' },
            recurrenceEnd: { type: 'string', description: 'End date for recurrence in YYYY-MM-DD format, or empty for no end' },
            calendarId: { type: 'string', description: 'Calendar id to add the event to. Defaults to "default" (My Schedule).' },
          },
          required: ['title', 'date'],
        },
      },
      {
        name: 'mark_task_done',
        description: 'Mark a task as done by its id',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The event/task id to mark as done' },
          },
          required: ['id'],
        },
      },
      {
        name: 'delete_event',
        description: 'Delete an event or task by its id',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The event/task id to delete' },
          },
          required: ['id'],
        },
      },
      {
        name: 'add_note',
        description: 'Create a new note',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Note title' },
            body: { type: 'string', description: 'Note body text' },
          },
          required: ['title'],
        },
      },
      {
        name: 'add_goal',
        description: 'Create a new goal to track',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Goal name' },
            target: { type: 'number', description: 'Target number to reach per period' },
            frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'], description: 'How often the goal resets' },
          },
          required: ['name', 'target', 'frequency'],
        },
      },
    ],
  },
]

export async function sendToGemini(apiKey, messages, context) {
  const systemPrompt = `You are a helpful assistant built into a student's personal calendar and goal-tracking app. You have access to their schedule, goals, and notes. Be concise, friendly, and helpful. When relevant, reference their actual data to give personalized advice.

You can also make changes to the user's calendar, tasks, goals, and notes using the provided tools. When the user asks you to add, delete, or modify something, use the appropriate tool. Today's date is ${new Date().toISOString().split('T')[0]}.

When adding events, use the event type ids from the user's data. The default event types include "task" and "exam". If the user mentions an event type that matches one of their custom types, use that type's id.

Here is the user's current data:
${context}`

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Got it! I have access to your schedule, goals, and notes, and I can make changes for you. How can I help?' }] },
    ...messages.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    })),
  ]

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      tools: TOOLS,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error ${res.status}`)
  }

  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts || []

  const functionCalls = parts.filter((p) => p.functionCall)
  const textParts = parts.filter((p) => p.text)
  const text = textParts.map((p) => p.text).join('') || null

  return {
    text,
    actions: functionCalls.map((p) => ({
      name: p.functionCall.name,
      args: p.functionCall.args,
    })),
  }
}

export function buildContext(events, goals, notes, eventTypes, calendars) {
  const lines = []

  if (calendars && calendars.length > 0) {
    lines.push('## Calendars')
    calendars.forEach((c) => {
      lines.push(`- id: "${c.id}", name: "${c.name}"`)
    })
  }

  if (eventTypes && eventTypes.length > 0) {
    lines.push('\n## Event Types')
    eventTypes.forEach((t) => {
      lines.push(`- id: "${t.id}", label: "${t.label}"`)
    })
  }

  if (events.length > 0) {
    lines.push('\n## Upcoming Events & Tasks')
    const now = new Date()
    const upcoming = events
      .filter((e) => new Date(e.date) >= new Date(now.toDateString()))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 20)
    upcoming.forEach((e) => {
      const status = e.done ? '(done)' : ''
      const time = e.time || 'no time'
      lines.push(`- id:"${e.id}" ${e.date} ${time}: ${e.title} [${e.type}] ${status}`)
    })
  }

  if (goals.length > 0) {
    lines.push('\n## Goals')
    goals.forEach((g) => {
      const progress = g.progress || {}
      const latest = Object.entries(progress).sort().pop()
      const current = latest ? latest[1] : 0
      lines.push(`- id:"${g.id}" ${g.name}: ${current}/${g.target} (${g.frequency})`)
    })
  }

  if (notes.length > 0) {
    lines.push('\n## Recent Notes')
    const recent = [...notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)
    recent.forEach((n) => {
      lines.push(`- id:"${n.id}" ${n.title || 'Untitled'}: ${(n.body || '').slice(0, 100)}`)
    })
  }

  return lines.join('\n') || 'No data yet.'
}
