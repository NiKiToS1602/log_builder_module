import { renderCalendar } from './calendar.js'
import { renderEmployees, renderLocations } from './directory.js'
import { element, icon } from './ui.js'

const links = [
  { label: 'Филиалы', icon: 'locations', path: '/locations', render: renderLocations },
  { label: 'Сотрудники', icon: 'employees', path: '/employees', render: renderEmployees },
  { label: 'Журналы', icon: 'journals' },
  { label: 'Шаблоны', icon: 'templates' },
  { label: 'Конструктор', icon: 'builder' },
  { label: 'График', icon: 'schedule', path: '/', render: renderCalendar },
  { label: 'Контроль', icon: 'control' },
]

const navigation = document.querySelector('.navigation')
const actionBar = document.querySelector('.action-bar')
const page = document.querySelector('#page')

function renderRoute(focusPage = false) {
  const path = location.pathname.replace(/\/$/, '') || '/'
  const current = links.find((link) => link.path === path) ?? links.find((link) => link.path === '/')

  navigation.replaceChildren(...links.map((link) => {
    const active = link === current
    const item = element(link.path ? 'a' : 'span', 'nav-link')
    item.setAttribute('aria-label', link.label)

    if (link.path) item.href = link.path
    else {
      item.setAttribute('role', 'link')
      item.setAttribute('aria-disabled', 'true')
    }
    if (active) item.setAttribute('aria-current', 'page')

    const name = active ? link.icon + '-active' : link.icon
    const arrow = icon('nav-arrow')
    arrow.classList.add('nav-arrow')
    item.append(icon(name), element('span', 'nav-label', link.label), arrow)
    return item
  }))

  const dialog = document.querySelector('dialog[open]')
  if (dialog) dialog.close()
  document.title = current.label + ' · Журналы контроля'
  actionBar.replaceChildren()
  page.replaceChildren(element('h1', 'page-title', current.label))
  current.render(page, actionBar)
  page.scrollTop = 0
  if (focusPage) page.focus()
}

navigation.addEventListener('click', (event) => {
  const link = event.target.closest('a')
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  if (link.pathname === location.pathname) return
  history.pushState(null, '', link.pathname)
  renderRoute(true)
})

window.addEventListener('popstate', () => renderRoute(true))
renderRoute()
