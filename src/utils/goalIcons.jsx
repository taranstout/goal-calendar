const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const GOAL_ICONS = [
  {
    id: 'target',
    label: 'Target',
    icon: (cls) => (
      <svg viewBox="0 0 24 24" {...s} className={cls}>
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      </svg>
    ),
  },
  {
    id: 'flame',
    label: 'Flame',
    icon: (cls) => (
      <svg viewBox="0 0 24 24" {...s} className={cls}>
        <path d="M12 2c1 4-2 6-2 10a4 4 0 0 0 8 0c0-4-3-6-2-10"/>
        <path d="M12 22a4 4 0 0 1-4-4c0-2 1-3 2-5 1 2 2 3 2 5a4 4 0 0 1-4 4"/>
      </svg>
    ),
  },
  {
    id: 'book',
    label: 'Book',
    icon: (cls) => (
      <svg viewBox="0 0 24 24" {...s} className={cls}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  {
    id: 'dumbbell',
    label: 'Fitness',
    icon: (cls) => (
      <svg viewBox="0 0 24 24" {...s} className={cls}>
        <path d="M6 5v14"/><path d="M18 5v14"/><path d="M6 12h12"/>
        <path d="M3 8v8"/><path d="M21 8v8"/>
      </svg>
    ),
  },
  {
    id: 'heart',
    label: 'Health',
    icon: (cls) => (
      <svg viewBox="0 0 24 24" {...s} className={cls}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
  {
    id: 'star',
    label: 'Star',
    icon: (cls) => (
      <svg viewBox="0 0 24 24" {...s} className={cls}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    id: 'music',
    label: 'Music',
    icon: (cls) => (
      <svg viewBox="0 0 24 24" {...s} className={cls}>
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      </svg>
    ),
  },
  {
    id: 'pencil',
    label: 'Writing',
    icon: (cls) => (
      <svg viewBox="0 0 24 24" {...s} className={cls}>
        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
      </svg>
    ),
  },
  {
    id: 'sun',
    label: 'Mindful',
    icon: (cls) => (
      <svg viewBox="0 0 24 24" {...s} className={cls}>
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    ),
  },
  {
    id: 'coffee',
    label: 'Habit',
    icon: (cls) => (
      <svg viewBox="0 0 24 24" {...s} className={cls}>
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
        <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
      </svg>
    ),
  },
  {
    id: 'trophy',
    label: 'Trophy',
    icon: (cls) => (
      <svg viewBox="0 0 24 24" {...s} className={cls}>
        <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
        <path d="M6 5v4a6 6 0 0 0 12 0V5H6z"/><path d="M12 15v3"/>
        <path d="M8 21h8"/><path d="M9 18h6"/>
      </svg>
    ),
  },
  {
    id: 'run',
    label: 'Running',
    icon: (cls) => (
      <svg viewBox="0 0 24 24" {...s} className={cls}>
        <circle cx="14" cy="4" r="2"/>
        <path d="M18 22l-4-8-4 4-4-3"/><path d="M6 13l4-4 4 4 4-7"/>
      </svg>
    ),
  },
]

export function getGoalIcon(iconId) {
  return GOAL_ICONS.find((i) => i.id === iconId) || GOAL_ICONS[0]
}
