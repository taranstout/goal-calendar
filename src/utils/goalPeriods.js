import { format, startOfWeek, startOfDay, isBefore, isAfter, endOfWeek, endOfMonth, startOfMonth } from 'date-fns'

/**
 * Get the period key for a given frequency and date.
 * daily:   "2026-07-07"
 * weekly:  "2026-W28"
 * monthly: "2026-07"
 */
export function getPeriodKey(frequency, date = new Date()) {
  const d = startOfDay(date)
  switch (frequency) {
    case 'daily':
      return format(d, 'yyyy-MM-dd')
    case 'weekly': {
      // ISO week: week starts on Monday
      const weekStart = startOfWeek(d, { weekStartsOn: 0 })
      const year = format(weekStart, 'yyyy')
      // Calculate ISO week number
      const jan1 = new Date(weekStart.getFullYear(), 0, 1)
      const days = Math.floor((weekStart - jan1) / 86400000)
      const weekNum = Math.ceil((days + jan1.getDay() + 1) / 7)
      return `${year}-W${String(weekNum).padStart(2, '0')}`
    }
    case 'monthly':
      return format(d, 'yyyy-MM')
    default:
      return format(d, 'yyyy-MM-dd')
  }
}

/**
 * Get the current progress for a goal in the current period.
 */
export function getCurrentProgress(goal, date = new Date()) {
  const key = getPeriodKey(goal.frequency || 'weekly', date)
  const progress = goal.progress || {}
  return progress[key] || 0
}

/**
 * Check if a date falls within the current period for a given frequency.
 */
export function isInCurrentPeriod(frequency, checkDate, refDate = new Date()) {
  const d = startOfDay(checkDate)
  const ref = startOfDay(refDate)
  switch (frequency) {
    case 'daily':
      return d.getTime() === ref.getTime()
    case 'weekly': {
      const weekStart = startOfWeek(ref, { weekStartsOn: 0 })
      const weekEnd = endOfWeek(ref, { weekStartsOn: 0 })
      return !isBefore(d, weekStart) && !isAfter(d, weekEnd)
    }
    case 'monthly': {
      const monthStart = startOfMonth(ref)
      const monthEnd = endOfMonth(ref)
      return !isBefore(d, monthStart) && !isAfter(d, monthEnd)
    }
    default:
      return false
  }
}
