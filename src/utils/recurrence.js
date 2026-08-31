import { addDays, addWeeks, addMonths, isBefore, isSameDay, startOfDay } from 'date-fns'

export const RECURRENCE_OPTIONS = [
  { id: 'none', label: 'Does not repeat' },
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Every weekday (Mon–Fri)' },
  { id: 'weekly', label: 'Every week' },
  { id: 'biweekly', label: 'Every 2 weeks' },
  { id: 'monthly', label: 'Every month' },
  { id: 'custom', label: 'Custom...' },
]

/**
 * Given a base event with recurrence info, generate occurrences
 * that fall on `targetDate`.
 */
export function eventOccursOn(event, targetDate) {
  const baseDate = startOfDay(new Date(event.date))
  const target = startOfDay(targetDate)

  // No recurrence — just check the base date
  if (!event.recurrence || event.recurrence === 'none') {
    return isSameDay(baseDate, target)
  }

  // Don't generate occurrences before the event was created
  if (isBefore(target, baseDate)) return false

  // Check end date if set
  if (event.recurrenceEnd && isBefore(startOfDay(new Date(event.recurrenceEnd)), target)) {
    return false
  }

  const rec = event.recurrence

  if (rec === 'daily') {
    return true
  }

  if (rec === 'weekdays') {
    const dow = target.getDay()
    return dow >= 1 && dow <= 5
  }

  if (rec === 'weekly') {
    return target.getDay() === baseDate.getDay()
  }

  if (rec === 'biweekly') {
    if (target.getDay() !== baseDate.getDay()) return false
    const diffDays = Math.round((target - baseDate) / (1000 * 60 * 60 * 24))
    return diffDays % 14 === 0
  }

  if (rec === 'monthly') {
    return target.getDate() === baseDate.getDate()
  }

  if (rec === 'custom' && event.customRecurrence) {
    const { every, unit, days } = event.customRecurrence

    if (unit === 'days') {
      const diffDays = Math.round((target - baseDate) / (1000 * 60 * 60 * 24))
      return diffDays >= 0 && diffDays % every === 0
    }

    if (unit === 'weeks') {
      // Must be on one of the selected days of the week
      if (days && days.length > 0 && !days.includes(target.getDay())) return false
      const diffDays = Math.round((target - baseDate) / (1000 * 60 * 60 * 24))
      const diffWeeks = Math.floor(diffDays / 7)
      return diffWeeks % every === 0
    }

    if (unit === 'months') {
      if (target.getDate() !== baseDate.getDate()) return false
      const diffMonths =
        (target.getFullYear() - baseDate.getFullYear()) * 12 +
        (target.getMonth() - baseDate.getMonth())
      return diffMonths >= 0 && diffMonths % every === 0
    }
  }

  return false
}
