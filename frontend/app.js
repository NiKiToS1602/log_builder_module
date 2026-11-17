import { renderCalendar } from './calendar.js'
import { renderEmployees, renderLocations } from './directory.js'
import { renderJournal, renderJournals } from './journals.js'
import { renderTemplates } from './templates.js'
import { element, icon } from './ui.js'

const links = [
  { label: 'Филиалы', icon: 'locations', activeIcon: 'locations-active', path: '/locations', render: renderLocations },
  { label: 'Сотрудники', icon: 'employees', activeIcon: 'employees-active', path: '/employees', render: renderEmployees },
  { label: 'Журналы', icon: 'journals', activeIcon: 'journals-active', path: '/journals', render: renderJournals },
  { label: 'Шаблоны', icon: 'templates', path: '/templates', render: renderTemplates },
  { label: 'График', icon: 'schedule', activeIcon: 'schedule-active', path: '/', render: renderCalendar },
  { label: 'Контроль', icon: 'control' },
]

const navigation = document.querySelector('.navigation')
const actionBar = document.querySelector('.action-bar')
const page = document.querySelector('#page')

function renderRoute(focusPage = false) {
  const path = location.pathname.replace(/\/$/, '') || '/'
  const journalId = path.match(/^\/journals\/([0-9a-f-]+)$/)?.[1]
  const sectionPath = journalId ? '/journals' : path
  const current = links.find((link) => link.path === sectionPath) ?? links.find((link) => link.path === '/')

  navigation.replaceChildren(...links.map((link) => {
    const active = link === current
    const item = element(link.path ? 'a' : 'span', 'nav-link')
    item.setAttribute('aria-label', link.label)

    if (link.path) {
      item.href = link.path
      item.dataset.route = ''
    } else {
      item.setAttribute('role', 'link')
      item.setAttribute('aria-disabled', 'true')
    }
    if (active) item.setAttribute('aria-current', 'page')

    const name = active ? (link.activeIcon ?? link.icon) : link.icon
    const arrow = icon('nav-arrow')
    arrow.classList.add('nav-arrow')
    item.append(icon(name), element('span', 'nav-label', link.label), arrow)
    return item
  }))

  const dialog = document.querySelector('dialog[open]')
  if (dialog) dialog.close()
  document.title = current.label + ' · Журналы контроля'
  actionBar.replaceChildren()
  page.replaceChildren()
  page.setAttribute('aria-label', current.label)
  if (journalId) renderJournal(page, actionBar, journalId, navigate)
  else current.render?.(page, actionBar, navigate)
  page.scrollTop = 0
  if (focusPage) page.focus()
}

function navigate(path) {
  if (path === location.pathname) return
  history.pushState(null, '', path)
  renderRoute(true)
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-route]')
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  navigate(link.pathname)
})

window.addEventListener('popstate', () => renderRoute(true))
renderRoute()
