export const scheduleFrequencies = {
  none: 'По необходимости',
  once: 'Один раз в дату начала',
  daily: 'По дням',
  weekly: 'По неделям',
  monthly: 'По месяцам',
  custom: 'В отдельные даты',
}

export const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function isJournalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function formatJournalDate(date) {
  return date.split('-').reverse().join('.')
}

export function localDate(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, '0')).join('-')
}

export function nextEntryDates({ status, columns, entries }) {
  const latest = entries.at(-1)
  if (status !== 'active' || !latest) return []
  const dates = columns
    .filter(({ type, id }) => type === 'next-date' && !latest.skippedColumns?.includes(id))
    .map(({ id }) => latest[id])
    .filter(isJournalDate)
  return [...new Set(dates)]
}

export function isScheduledJournalDay({ schedule, startDate, status }, date) {
  if (status !== 'active' || !schedule || !isJournalDate(startDate) || !isJournalDate(date)) return false
  if (date < startDate || (schedule.endDate && date > schedule.endDate)) return false

  if (schedule.frequency === 'once') return date === startDate
  if (schedule.frequency === 'custom') return schedule.dates.includes(date)

  const start = new Date(startDate)
  const day = new Date(date)
  const daysSinceStart = (day - start) / 86_400_000
  switch (schedule.frequency) {
    case 'daily':
      return daysSinceStart % schedule.interval === 0
    case 'weekly': {
      const startWeekday = (start.getUTCDay() + 6) % 7
      const week = Math.floor((daysSinceStart + startWeekday) / 7)
      const weekday = (day.getUTCDay() + 6) % 7 + 1
      return week % schedule.interval === 0 && schedule.weekdays.includes(weekday)
    }
    case 'monthly': {
      const month = (day.getUTCFullYear() - start.getUTCFullYear()) * 12 + day.getUTCMonth() - start.getUTCMonth()
      if (month % schedule.interval !== 0) return false
      const dayOfMonth = day.getUTCDate()
      if (schedule.monthDays.includes(dayOfMonth)) return true
      day.setUTCDate(dayOfMonth + 1)
      return schedule.lastDay && day.getUTCDate() === 1
    }
    default:
      return false
  }
}

export function normalizeJournalSchedule(schedule, startDate) {
  const frequency = schedule?.frequency ?? 'none'
  if (!Object.hasOwn(scheduleFrequencies, frequency)) throw new Error('Выберите периодичность заполнения.')
  if (frequency === 'none') return { frequency }

  const times = [...new Set(schedule.times ?? [])].filter(Boolean).sort()
  if (times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
    throw new Error('Укажите корректное время заполнения.')
  }
  const result = { frequency, times }
  if (frequency === 'once') return result
  if (frequency === 'custom') {
    const dates = [...new Set(schedule.dates ?? [])].filter(Boolean).sort()
    if (!dates.length || dates.some((date) => !isJournalDate(date) || date < startDate)) {
      throw new Error('Укажите даты заполнения начиная с даты начала журнала.')
    }
    return { ...result, dates }
  }

  const interval = Number(schedule.interval)
  if (!Number.isSafeInteger(interval) || interval < 1) throw new Error('Укажите целый интервал от 1.')
  result.interval = interval
  if (schedule.endDate) {
    if (!isJournalDate(schedule.endDate) || schedule.endDate < startDate) {
      throw new Error('Дата окончания расписания должна быть не раньше даты начала журнала.')
    }
    result.endDate = schedule.endDate
  }
  if (frequency === 'weekly') {
    const days = [...new Set((schedule.weekdays ?? []).map(Number))].sort((a, b) => a - b)
    if (!days.length || days.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
      throw new Error('Выберите хотя бы один день недели.')
    }
    result.weekdays = days
  }
  if (frequency === 'monthly') {
    const rawDays = schedule.monthDays?.trim()
    const tokens = rawDays ? rawDays.split(/[\s,]+/) : []
    const days = [...new Set(tokens.map(Number))].sort((a, b) => a - b)
    const lastDay = Boolean(schedule.lastDay)
    if ((!days.length && !lastDay) || tokens.some((token) => !/^\d{1,2}$/.test(token))
      || days.some((day) => day < 1 || day > 31)) {
      throw new Error('Укажите числа месяца от 1 до 31 или выберите последний день месяца.')
    }
    result.monthDays = days
    result.lastDay = lastDay
  }
  return result
}

export function formatJournalSchedule(schedule) {
  if (!schedule) return '—'
  const { frequency, interval, times, endDate } = schedule
  if (frequency === 'none') return scheduleFrequencies.none
  const parts = []
  switch (frequency) {
    case 'once': parts.push(scheduleFrequencies.once); break
    case 'daily': parts.push(interval === 1 ? 'Ежедневно' : 'Интервал ' + interval + ' дн.'); break
    case 'weekly':
      parts.push(interval === 1 ? 'Каждую неделю' : 'Интервал ' + interval + ' нед.')
      parts.push(schedule.weekdays.map((day) => weekdays[day - 1]).join(', '))
      break
    case 'monthly': {
      parts.push(interval === 1 ? 'Каждый месяц' : 'Интервал ' + interval + ' мес.')
      if (schedule.monthDays.length) parts.push('Числа месяца: ' + schedule.monthDays.join(', '))
      if (schedule.lastDay) parts.push('Последний день месяца')
      break
    }
    case 'custom': parts.push(schedule.dates.map(formatJournalDate).join(', ')); break
  }
  if (times.length) parts.push('В ' + times.join(', '))
  if (endDate) parts.push('По ' + formatJournalDate(endDate) + ' включительно')
  return parts.join(' · ')
}
