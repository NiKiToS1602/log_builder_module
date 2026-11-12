import { directory } from './data.js'
import { element, filterSelect, icon, searchField, showDialog } from './ui.js'

const pageSize = 5
const statuses = {
  active: 'Активный',
  inactive: 'Неактивный',
  archived: 'Архивный',
}

function matchesSearch(name, query) {
  return name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))
}

function detailList(fields) {
  const list = element('dl', 'detail-list')
  for (const [label, value] of fields) {
    list.append(element('dt', '', label), element('dd', '', value ?? '—'))
  }
  return list
}

function previewButton(name, fields) {
  const button = element('button', 'preview-button')
  button.type = 'button'
  button.setAttribute('aria-label', 'Подробнее: ' + name)
  button.setAttribute('aria-haspopup', 'dialog')
  button.append(icon('preview'))
  button.addEventListener('click', () => showDialog(name, detailList(fields)))
  return button
}

function nameCell(name, identifier) {
  const cell = element('th', 'record-name', name)
  cell.scope = 'row'
  cell.append(element('span', 'record-id', 'ID ' + identifier))
  return cell
}

function directoryTable(page, className, labels) {
  const wrapper = element('div', 'table-scroll')
  const table = element('table', 'directory-table ' + className)
  const head = table.createTHead().insertRow()
  for (const label of [...labels, 'Действия']) {
    const heading = element('th', '', label)
    heading.scope = 'col'
    head.append(heading)
  }
  head.lastElementChild.className = 'actions-heading'
  head.lastElementChild.replaceChildren(element('span', 'sr-only', 'Действия'))
  const body = table.createTBody()
  wrapper.append(table)
  page.append(wrapper)
  return body
}

function renderRows(body, rows, renderRow) {
  body.replaceChildren()
  if (rows.length === 0) {
    const cell = body.insertRow().insertCell()
    cell.colSpan = 4
    cell.className = 'empty'
    cell.textContent = 'Ничего не найдено'
    return
  }
  for (const row of rows) renderRow(body.insertRow(), row)
}

function employeeRow(row, employee) {
  const { full_name: name, member_uid: id, primary_location: location, primary_position: position } = employee
  const locationName = location?.name ?? '—'
  const positionName = position?.name ?? '—'
  row.append(
    nameCell(name, id),
    element('td', '', locationName),
    element('td', '', positionName),
    element('td', 'row-action'),
  )
  row.lastElementChild.append(previewButton(name, [
    ['ID', id],
    ['Основной филиал', locationName],
    ['Должность', positionName],
  ]))
}

function locationRow(row, { id, name, status, address }) {
  const statusCell = element('td')
  statusCell.append(element('span', 'status status-' + status, statuses[status]))
  row.append(nameCell(name, id), statusCell, element('td', '', address ?? '—'), element('td', 'row-action'))
  row.lastElementChild.append(previewButton(name, [
    ['ID', id],
    ['Статус', statuses[status]],
    ['Адрес', address],
  ]))
}

export function renderEmployees(page, actionBar) {
  const { wrapper, input } = searchField('Поиск по ФИО')
  const filters = element('div', 'employee-filters')
  const { wrapper: positionFilter, select: byPosition } = filterSelect('По должности', directory.getPositions())
  const { wrapper: locationFilter, select: byLocation } = filterSelect('По филиалу', directory.getLocations())
  filters.append(positionFilter, locationFilter)
  const refresh = element('button', 'primary-button refresh', 'Обновить')
  refresh.type = 'button'
  actionBar.append(wrapper, filters, refresh)

  const table = directoryTable(page, 'employee-table', ['ФИО', 'Основной филиал', 'Должность'])
  const pagination = element('nav', 'pagination')
  pagination.setAttribute('aria-label', 'Страницы списка сотрудников')
  const range = element('span', 'page-range')
  range.setAttribute('aria-live', 'polite')
  const previous = element('button', '', 'Назад')
  const next = element('button', '', 'Вперёд')
  const pageNumber = element('span', 'page-number')
  pageNumber.setAttribute('aria-current', 'page')
  pagination.append(range, previous, pageNumber, next)
  const refreshStatus = element('p', 'sr-only')
  refreshStatus.setAttribute('role', 'status')
  page.append(pagination, refreshStatus)

  let employees = directory.getEmployees()
  let currentPage = 1

  function update() {
    const filtered = employees.filter((employee) => (
      matchesSearch(employee.full_name, input.value)
      && (!byLocation.value || String(employee.primary_location?.id) === byLocation.value)
      && (!byPosition.value || String(employee.primary_position?.id) === byPosition.value)
    ))
    const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize))
    currentPage = Math.min(currentPage, lastPage)
    const start = (currentPage - 1) * pageSize
    const end = Math.min(start + pageSize, filtered.length)

    renderRows(table, filtered.slice(start, end), employeeRow)
    range.textContent = filtered.length ? (start + 1) + '–' + end + ' из ' + filtered.length : '0 из 0'
    pageNumber.textContent = String(currentPage)
    previous.disabled = currentPage === 1
    next.disabled = currentPage === lastPage
  }

  function applyFilters() {
    currentPage = 1
    update()
  }

  input.addEventListener('input', applyFilters)
  byPosition.addEventListener('change', applyFilters)
  byLocation.addEventListener('change', applyFilters)
  previous.addEventListener('click', () => {
    currentPage -= 1
    update()
  })
  next.addEventListener('click', () => {
    currentPage += 1
    update()
  })
  refresh.addEventListener('click', () => {
    employees = directory.getEmployees()
    update()
    refreshStatus.textContent = 'Список сотрудников обновлён.'
  })

  update()
}

export function renderLocations(page, actionBar) {
  const { wrapper, input } = searchField('Поиск по названию филиала')
  actionBar.append(wrapper)
  const table = directoryTable(page, 'location-table', ['Филиал', 'Статус', 'Адрес'])
  const locations = directory.getLocations()

  function update() {
    renderRows(table, locations.filter(({ name }) => matchesSearch(name, input.value)), locationRow)
  }

  input.addEventListener('input', update)
  update()
}
