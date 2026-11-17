import { journalDirectory } from './data.js'
import { getJournals } from './journal-data.js'
import { isScheduledJournalDay, localDate, nextEntryDates, weekdays } from './journal-schedule.js'
import { journalLocationChoices, journalLocationKey, routeLink } from './journals.js'
import { element, filterSelect, searchField, showDialog } from './ui.js'

const monthLabel = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' })
const dayLabel = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'full' })

export function renderCalendar(page, actionBar) {
  const { wrapper: search } = searchField('Поиск по сотруднику', true)

  let activeJournals = []
  try {
    activeJournals = getJournals()
      .filter(({ status }) => status === 'active')
      .map((journal) => ({ journal, nextDates: new Set(nextEntryDates(journal)) }))
  } catch {
    const error = element('p', 'journal-form-error', 'Не удалось загрузить даты заполнения журналов.')
    error.setAttribute('role', 'alert')
    page.append(error)
  }
  const { locations } = journalDirectory()
  const { wrapper: branch, select: byLocation } = filterSelect('По филиалу',
    journalLocationChoices(locations, activeJournals.map(({ journal }) => journal)))
  byLocation.addEventListener('change', update)

  const now = new Date()
  const today = localDate(now)
  let month = new Date(now.getFullYear(), now.getMonth(), 1)

  const calendar = element('section', 'calendar')
  calendar.setAttribute('aria-labelledby', 'calendar-month')
  const monthHeading = element('h2', 'calendar-month')
  monthHeading.id = 'calendar-month'
  monthHeading.setAttribute('aria-live', 'polite')
  const toolbar = element('div', 'calendar-toolbar')
  const previous = element('button', 'outline-button', '←')
  const next = element('button', 'outline-button', '→')
  previous.type = next.type = 'button'
  previous.setAttribute('aria-label', 'Предыдущий месяц')
  next.setAttribute('aria-label', 'Следующий месяц')
  previous.addEventListener('click', () => changeMonth(-1))
  next.addEventListener('click', () => changeMonth(1))
  toolbar.append(previous, monthHeading, next)
  actionBar.append(search, branch, toolbar)
  const grid = element('div', 'calendar-grid')
  calendar.append(grid)
  page.append(calendar)

  function changeMonth(offset) {
    month = new Date(month.getFullYear(), month.getMonth() + offset, 1)
    update()
  }

  function update() {
    const year = month.getFullYear()
    const monthIndex = month.getMonth()
    const start = (month.getDay() + 6) % 7
    const days = new Date(year, monthIndex + 1, 0).getDate()
    const slots = Math.ceil((start + days) / 7) * 7
    monthHeading.textContent = monthLabel.format(month)
    grid.replaceChildren(...weekdays.map((weekday) => element('div', 'weekday', weekday)))
    const branchJournals = activeJournals.filter(({ journal }) => (
      !byLocation.value || journalLocationKey(journal) === byLocation.value
    ))

    for (let slot = 0; slot < slots; slot += 1) {
      const day = slot - start + 1
      if (day < 1 || day > days) {
        const spacer = element('div', 'calendar-spacer')
        spacer.setAttribute('aria-hidden', 'true')
        grid.append(spacer)
        continue
      }

      const date = new Date(year, monthIndex, day)
      const key = localDate(date)
      const label = dayLabel.format(date)
      const journals = []
      for (const { journal, nextDates } of branchJournals) {
        const scheduled = isScheduledJournalDay(journal, key)
        if (scheduled || nextDates.has(key)) {
          journals.push({ journal, times: scheduled ? (journal.schedule.times ?? []) : [] })
        }
      }
      const button = element('button', 'calendar-day', String(day))
      button.type = 'button'
      button.setAttribute('aria-label', journals.length ? label + ' · Журналов к заполнению: ' + journals.length : label)
      button.setAttribute('aria-haspopup', 'dialog')
      if (key === today) button.setAttribute('aria-current', 'date')
      if (journals.length) {
        button.classList.add('calendar-day-due')
        for (const { journal } of journals.slice(0, 2)) {
          button.append(element('span', 'calendar-due-name', journal.name))
        }
        button.append(element('span', 'calendar-due-count', String(journals.length)))
      }
      button.addEventListener('click', () => {
        if (!journals.length) {
          showDialog(label, element('p', 'empty', 'На этот день нет журналов к заполнению.'))
          return
        }
        const content = element('div')
        const list = element('ul', 'calendar-journals')
        for (const { journal, times } of journals) {
          const item = element('li')
          item.append(routeLink(journal.name, '/journals/' + journal.id, 'journal-link'))
          const branchName = journal.locationName || journal.localLocationName
          if (branchName) item.append(element('span', 'empty', ' · ' + branchName))
          if (times.length) item.append(element('div', 'calendar-journal-times', times.join(', ')))
          list.append(item)
        }
        content.append(element('p', '', 'Журналы к заполнению'), list)
        showDialog(label, content)
      })
      grid.append(button)
    }
  }
  update()
}
