import { directory } from './data.js'
import { element, filterSelect, searchField, showDialog } from './ui.js'

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const monthLabel = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' })
const dayLabel = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'full' })

export function renderCalendar(page, actionBar) {
  const { wrapper: search } = searchField('Поиск по сотруднику', true)
  const { wrapper: branch } = filterSelect('По филиалу', directory.getLocations(), true)
  actionBar.append(search, branch)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const first = new Date(year, month, 1)
  const start = (first.getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const slots = Math.ceil((start + days) / 7) * 7

  const calendar = element('section', 'calendar')
  calendar.setAttribute('aria-labelledby', 'calendar-month')
  const monthHeading = element('h2', 'calendar-month', monthLabel.format(first))
  monthHeading.id = 'calendar-month'

  const grid = element('div', 'calendar-grid')
  for (const weekday of weekdays) grid.append(element('div', 'weekday', weekday))

  for (let slot = 0; slot < slots; slot += 1) {
    const day = slot - start + 1
    if (day < 1 || day > days) {
      const spacer = element('div', 'calendar-spacer')
      spacer.setAttribute('aria-hidden', 'true')
      grid.append(spacer)
      continue
    }

    const date = new Date(year, month, day)
    const label = dayLabel.format(date)
    const button = element('button', 'calendar-day', String(day))
    button.type = 'button'
    button.setAttribute('aria-label', label)
    button.setAttribute('aria-haspopup', 'dialog')
    if (day === now.getDate()) button.setAttribute('aria-current', 'date')
    button.addEventListener('click', () => {
      showDialog(label, element('p', 'empty', 'Записей за этот день нет.'))
    })
    grid.append(button)
  }

  calendar.append(monthHeading, grid)
  page.append(calendar)
}
