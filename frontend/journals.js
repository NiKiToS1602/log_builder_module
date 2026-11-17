import { journalDirectory } from './data.js'
import {
  activateJournalDraft, addJournalEntry, canDeleteJournalDraft, completeJournal, confirmJournalEntry, createJournal, deleteJournalDraft,
  eligibleSigners, getJournals, getTemplateForJournal, getTemplates, isConfirmationComplete,
  isJournalArchived, isOutsideNumberRange, isTemplateArchived, saveJournalDraft, updateJournalDraft,
} from './journal-data.js'
import { element, filterSelect, rowActions, searchField, showDialog } from './ui.js'
import { formatJournalDate as formatDate, formatJournalSchedule, scheduleFrequencies, weekdays } from './journal-schedule.js'

const journalColumns = ['Название', 'Дата начала', 'Ответственный', 'Филиал', 'Действия']

export function journalTable(page, columns, className) {
  const wrapper = element('div', 'table-scroll')
  const table = element('table', 'journal-table ' + className)
  const head = table.createTHead().insertRow()
  for (const label of columns) {
    const heading = element('th', '', label)
    heading.scope = 'col'
    head.append(heading)
  }

  const body = table.createTBody()
  const status = element('p', 'journal-status empty')
  status.setAttribute('role', 'status')
  wrapper.append(table)
  page.append(wrapper, status)
  return { head, body, status }
}

export function routeLink(label, path, className) {
  const link = element('a', className, label)
  link.href = path
  link.dataset.route = ''
  return link
}

function references() {
  const { locations, employees: members } = journalDirectory()
  const employees = employeeChoices(members)
  return {
    locations,
    employees,
    members,
    locationName: (id) => locations.find((item) => String(item.id) === String(id))?.name ?? '—',
    employeeName: (id) => employees.find((item) => item.id === id)?.name ?? '—',
  }
}

function employeeChoices(employees) {
  return employees.map(({ member_uid, full_name }) => ({ id: member_uid, name: full_name }))
}

function appendCells(row, values) {
  for (const value of values) row.append(element('td', '', value))
}

export function inputField(label, name, type, { required = true, ...attributes } = {}) {
  const wrapper = element('label', 'journal-field')
  const input = element('input')
  input.type = type
  input.name = name
  input.required = required
  for (const [key, value] of Object.entries(attributes)) input.setAttribute(key, value)
  wrapper.append(element('span', '', label), input)
  return wrapper
}

function referenceField(label, name, choices, initialValue = '', required = false) {
  const { wrapper, select } = filterSelect(label, choices)
  select.name = name
  select.required = required
  if (required) select.disabled = false
  if (choices.some(({ id }) => String(id) === String(initialValue))) select.value = String(initialValue)
  return wrapper
}

function openForm(title, fields, save, afterSave, { label = 'Сохранить', skipValidation = false, alternate } = {}) {
  const form = element('form', 'journal-form')
  const error = element('p', 'journal-form-error')
  error.setAttribute('role', 'alert')
  error.hidden = true
  const submit = element('button', 'outline-button', label)
  submit.type = 'submit'
  submit.formNoValidate = skipValidation
  const footer = element('div', 'journal-form-footer')
  footer.append(submit)
  let alternateButton
  if (alternate) {
    alternateButton = element('button', 'outline-button', alternate.label)
    alternateButton.type = 'submit'
    alternateButton.formNoValidate = alternate.skipValidation ?? false
    footer.append(alternateButton)
  }
  form.append(...fields, error, footer)

  const dialog = showDialog(title, form)
  form.querySelector('input:not(:disabled), select:not(:disabled)')?.focus()
  form.addEventListener('input', (event) => event.target.setCustomValidity?.(''))

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (submit.disabled) return
    error.hidden = true
    for (const input of form.querySelectorAll('input[type=text]:required:enabled')) {
      if (input.value.trim()) continue
      input.setCustomValidity('Заполните это поле.')
      input.reportValidity()
      return
    }
    const data = Object.fromEntries(Array.from(new FormData(form), ([name, value]) => [
      name, typeof value === 'string' ? value.trim() : value,
    ]))

    let result
    const saveAction = alternate && event.submitter === alternateButton ? alternate.save : save
    submit.disabled = true
    if (alternateButton) alternateButton.disabled = true
    try {
      result = await saveAction(data, () => dialog.open && form.isConnected)
    } catch (problem) {
      error.textContent = problem.name === 'QuotaExceededError' ? 'В браузере закончилось место для записей.'
        : problem.message || 'Не удалось сохранить данные в браузере.'
      error.hidden = false
      return
    } finally {
      submit.disabled = false
      if (alternateButton) alternateButton.disabled = false
    }
    if (!dialog.open || !form.isConnected) return
    dialog.close()
    afterSave(result)
  })
}

function scheduleRows(legend, label, type, action) {
  const field = element('fieldset', 'schedule-options entry-field-controls')
  field.append(element('legend', '', legend))
  const rows = element('div', 'schedule-options')
  const add = element('button', 'outline-button', action)
  add.type = 'button'
  add.addEventListener('click', () => addRow().focus())
  field.append(rows, add)

  function addRow() {
    const row = element('div', 'schedule-row')
    const item = inputField(label, '', type, { required: true })
    const input = item.querySelector('input')
    const remove = element('button', 'outline-button', 'Убрать')
    remove.type = 'button'
    remove.setAttribute('aria-label', 'Убрать поле «' + label + '»')
    remove.addEventListener('click', () => {
      row.remove()
      add.focus()
    })
    row.append(item, remove)
    rows.append(row)
    return input
  }

  return { field, addRow, values: () => Array.from(rows.querySelectorAll('input'), ({ value }) => value) }
}

function journalScheduleField(initial = {}) {
  const field = element('fieldset', 'schedule-options entry-field-controls')
  const frequencyField = element('label', 'journal-field')
  const frequency = element('select')
  for (const [value, label] of Object.entries(scheduleFrequencies)) frequency.add(new Option(label, value))
  frequency.value = initial.frequency ?? 'none'
  frequencyField.append(element('span', '', 'Повторение'), frequency)

  const recurrence = element('fieldset', 'schedule-options entry-field-controls')
  const intervalField = inputField('Повторять каждые', '', 'number', { min: '1', step: '1', value: initial.interval ?? '1' })
  const intervalLabel = intervalField.firstElementChild
  const endField = inputField('Дата окончания расписания', '', 'date', { required: false, value: initial.endDate ?? '' })
  recurrence.append(intervalField, endField)

  const weekly = element('fieldset', 'entry-field-controls')
  weekly.append(element('legend', '', 'Дни недели'))
  const days = element('div', 'schedule-weekdays')
  weekdays.forEach((day, index) => {
    const label = element('label', 'entry-skip')
    const input = element('input')
    input.type = 'checkbox'
    input.value = String(index + 1)
    input.checked = initial.weekdays?.includes(index + 1) ?? false
    label.append(input, element('span', '', day))
    days.append(label)
  })
  weekly.append(days)

  const monthly = element('fieldset', 'schedule-options entry-field-controls')
  const monthDays = inputField('Числа месяца', '', 'text', {
    required: false, placeholder: 'Например, 1, 15, 25', value: initial.monthDays?.join(', ') ?? '',
  })
  const lastDayLabel = element('label', 'entry-skip')
  const lastDay = element('input')
  lastDay.type = 'checkbox'
  lastDay.checked = initial.lastDay ?? false
  lastDayLabel.append(lastDay, element('span', '', 'Последний день месяца'))
  monthly.append(monthDays, lastDayLabel, element('p', 'empty entry-hint', 'Даты, которых нет в месяце, пропускаются.'))

  const dates = scheduleRows('Отдельные даты', 'Дата заполнения', 'date', 'Добавить дату')
  for (const date of initial.dates ?? ['']) dates.addRow().value = date
  const times = scheduleRows('Время заполнения', 'Время', 'time', 'Добавить время')
  for (const time of initial.times ?? []) times.addRow().value = time
  const timeHint = element('p', 'empty entry-hint', 'Без указанного времени запись можно заполнить в течение дня.')
  times.field.insertBefore(timeHint, times.field.lastElementChild)
  field.append(element('legend', '', 'Периодичность заполнения'), frequencyField, recurrence, weekly, monthly, dates.field, times.field)

  function update() {
    const value = frequency.value
    const units = { daily: 'днях', weekly: 'неделях', monthly: 'месяцах' }
    for (const [group, visible] of [
      [recurrence, Object.hasOwn(units, value)],
      [weekly, value === 'weekly'],
      [monthly, value === 'monthly'],
      [dates.field, value === 'custom'],
      [times.field, value !== 'none'],
    ]) group.hidden = group.disabled = !visible
    if (units[value]) intervalLabel.textContent = 'Интервал в ' + units[value]
  }

  frequency.addEventListener('change', update)
  update()
  return {
    field,
    values: () => ({
      frequency: frequency.value,
      interval: intervalField.querySelector('input').value,
      endDate: endField.querySelector('input').value,
      weekdays: Array.from(weekly.querySelectorAll('input:checked'), ({ value }) => value),
      monthDays: monthDays.querySelector('input').value,
      lastDay: lastDay.checked,
      dates: dates.values(),
      times: times.values(),
    }),
  }
}

export function openJournalCreation(templateId, navigate) {
  let template
  try {
    template = getTemplateForJournal(templateId)
  } catch (problem) {
    const error = element('p', 'journal-form-error', problem.message)
    error.setAttribute('role', 'alert')
    showDialog('Новый журнал', error)
    return
  }
  openJournalSettings('Новый журнал', { name: template.name },
    (fields) => createJournal(templateId, fields), ({ id }) => navigate('/journals/' + id), {
      alternate: {
        label: 'Сохранить черновик', skipValidation: true, save: (fields) => saveJournalDraft(templateId, fields),
      },
    })
}

function openJournalSettings(title, journal, save, afterSave, { alternate, ...options }) {
  const { locations, employees } = references()
  const location = referenceField('Филиал', 'locationId', locations, journal.locationId, true)
  const locationSelect = location.querySelector('select')
  const legalEntity = inputField('Юр. лицо', '', 'text', {
    required: false, readonly: '', placeholder: 'Выберите филиал',
  })
  const legalEntityInput = legalEntity.querySelector('input')
  const schedule = journalScheduleField(journal.schedule)
  function updateLegalEntity() {
    const branch = locations.find(({ id }) => String(id) === locationSelect.value)
    legalEntityInput.value = branch?.legal_entity?.name?.trim() ?? ''
    legalEntityInput.placeholder = branch ? 'В справочнике не указано' : 'Выберите филиал'
  }
  locationSelect.addEventListener('change', updateLegalEntity)
  updateLegalEntity()
  const withSchedule = (fields) => ({ ...fields, schedule: schedule.values() })
  openForm(title, [
    inputField('Название журнала', 'name', 'text', { maxlength: '120', value: journal.name }),
    location,
    legalEntity,
    referenceField('Ответственный сотрудник', 'employeeId', employees, journal.employeeId, true),
    inputField('Дата начала', 'startDate', 'date', { value: journal.startDate ?? '' }),
    schedule.field,
  ], (fields) => save(withSchedule(fields)), afterSave, {
    ...options,
    alternate: { ...alternate, save: (fields) => alternate.save(withSchedule(fields)) },
  })
}

function chooseJournalTemplate(navigate) {
  const title = 'Создать из шаблона'
  let templates
  try {
    templates = getTemplates().filter((template) => !isTemplateArchived(template))
  } catch {
    const error = element('p', 'journal-form-error', 'Не удалось загрузить шаблоны из браузера.')
    error.setAttribute('role', 'alert')
    showDialog(title, error)
    return
  }
  if (!templates.length) {
    showDialog(title, element('p', 'empty', 'Активных шаблонов пока нет. Создайте или восстановите шаблон в разделе «Шаблоны».'))
    return
  }

  openForm(title, [referenceField('Выберите шаблон', 'templateId', templates, '', true)],
    ({ templateId }) => getTemplateForJournal(templateId).id,
    (templateId) => openJournalCreation(templateId, navigate), { label: 'Продолжить' })
}

export function journalLocationKey(journal) {
  if (journal.locationId) return String(journal.locationId)
  return journal.localLocationName ? 'local:' + journal.localLocationName : ''
}

export function journalLocationChoices(locations, journals) {
  const choices = new Map(locations.map(({ id, name }) => [String(id), name]))
  for (const journal of journals) {
    const key = journalLocationKey(journal)
    const name = journal.locationName || journal.localLocationName
    if (key && name && !choices.has(key)) choices.set(key, name)
  }
  return Array.from(choices, ([id, name]) => ({ id, name }))
}

export function renderJournals(page, actionBar, navigate) {
  const refs = references()
  const { locations, locationName, employeeName } = refs
  const { wrapper: search, input } = searchField('Поиск по названию журнала')
  const categories = element('div', 'journal-categories')
  categories.setAttribute('role', 'group')
  categories.setAttribute('aria-label', 'Статус журнала')
  page.append(categories)
  const { head, body, status } = journalTable(page, journalColumns, 'journal-list')
  head.cells[4].replaceChildren(element('span', 'sr-only', 'Действия'))
  let journals
  try {
    journals = getJournals()
  } catch {
    status.textContent = 'Не удалось загрузить журналы из браузера.'
    return
  }

  const { wrapper: filter, select: byLocation } = filterSelect('По филиалу', journalLocationChoices(locations, journals))
  const create = element('button', 'primary-button journal-action', 'Создать из шаблона')
  create.type = 'button'
  create.setAttribute('aria-haspopup', 'dialog')
  create.addEventListener('click', () => chooseJournalTemplate(navigate))
  actionBar.append(search, filter, create)

  let category = 'active'
  for (const [value, label] of [['active', 'Активные'], ['draft', 'Черновики'], ['archived', 'Архив']]) {
    const button = element('button', 'outline-button', label)
    button.type = 'button'
    button.dataset.status = value
    button.addEventListener('click', () => {
      category = value
      update()
    })
    categories.append(button)
  }

  function refreshList() {
    journals = getJournals()
    update()
    categories.querySelector('[aria-pressed="true"]').focus()
  }

  function journalActions(journal) {
    if (isJournalArchived(journal)) {
      return [['Печать', () => {
        navigate('/journals/' + journal.id)
        window.print()
      }, false]]
    }
    if (journal.status === 'draft') {
      const actions = [['Редактировать черновик', () => openDraftSettings(journal, refreshList)]]
      if (canDeleteJournalDraft(journal)) actions.push(['Удалить', () => showDraftDeletion(journal, refreshList)])
      return actions
    }
    return [
      ['Добавить запись', () => openJournalEntry(journal, refs, refreshList)],
      ['Завершить журнал', () => showJournalCompletion(journal, refreshList)],
    ]
  }

  function update() {
    const archived = category === 'archived'
    head.cells[1].textContent = archived ? 'Период' : 'Дата начала'
    for (const button of categories.children) {
      button.setAttribute('aria-pressed', String(button.dataset.status === category))
    }
    const query = input.value.trim().toLocaleLowerCase('ru')
    const group = journals.filter(archived ? isJournalArchived : ({ status }) => status === category)
    const visible = group.filter((journal) => (
      journal.name.toLocaleLowerCase('ru').includes(query)
      && (!byLocation.value || journalLocationKey(journal) === byLocation.value)
    ))

    body.replaceChildren()
    for (const journal of visible) {
      const row = body.insertRow()
      const name = row.insertCell()
      name.append(routeLink(journal.name, '/journals/' + journal.id, 'journal-link'))
      const start = journal.startDate ? formatDate(journal.startDate) : '—'
      const end = journal.completedDate ? formatDate(journal.completedDate) : '—'
      appendCells(row, [
        archived && (journal.startDate || journal.completedDate) ? start + '-' + end : start,
        journal.employeeName || employeeName(journal.employeeId),
        journal.locationName || journal.localLocationName || locationName(journal.locationId),
      ])
      row.append(rowActions('journal-actions-' + journal.id, 'Действия журнала «' + journal.name + '»', journalActions(journal)))
    }
    const emptyMessage = {
      active: 'Активных журналов пока нет.',
      draft: 'Черновиков пока нет.',
      archived: 'В архиве пока нет журналов.',
    }
    status.textContent = visible.length ? '' : group.length ? 'Журналы не найдены.' : emptyMessage[category]
  }

  input.addEventListener('input', update)
  byLocation.addEventListener('change', update)
  update()
}

const imageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
function entryField(column, journal, { locations, employees, members }, author) {
  const { id, name, type, required, mode } = column
  if (type === 'sequence' || mode === 'auto' || mode === 'later') {
    const hints = {
      sequence: 'При сохранении',
      date: 'Текущая дата',
      employee: 'Автор записи',
      location: 'Основной филиал автора',
      confirmation: 'После сохранения',
    }
    return element('p', 'empty entry-hint', name + ' · ' + hints[type])
  }
  if (type === 'confirmation') {
    const wrapper = element('div', 'journal-form')
    const field = referenceField(name + ' · кто подтверждает', id, [], '', true)
    const select = field.querySelector('select')
    function updateChoices() {
      select.options.length = 1
      for (const { full_name, member_uid } of eligibleSigners(column, author.value, members)) {
        select.add(new Option(full_name, member_uid))
      }
      select.selectedIndex = 0
      check.checked = false
    }
    const approval = element('label', 'builder-required')
    const check = element('input')
    check.type = 'checkbox'
    check.required = true
    approval.append(check, element('span', '', 'Подтверждаю запись'))
    wrapper.append(field, approval)
    author.addEventListener('change', updateChoices)
    select.addEventListener('change', () => { check.checked = false })
    updateChoices()
    return wrapper
  }
  if (type === 'location') return referenceField(name, id, locations, journal.locationId, required)
  if (type === 'employee') return referenceField(name, id, employees, journal.employeeId, required)
  if (type === 'image') return inputField(name, id, 'file', { required, accept: imageTypes.join(',') })
  if (type === 'boolean') {
    const { wrapper, select } = filterSelect(name, [{ id: 'yes', name: 'Да' }, { id: 'no', name: 'Нет' }])
    select.name = id
    select.required = required
    return wrapper
  }
  const attributes = { required }
  if (column.placeholder) attributes.placeholder = column.placeholder
  if (type === 'number') {
    attributes.step = 'any'
  }
  const field = inputField(name, id, type === 'next-date' ? 'date' : type, attributes)
  if (type === 'number' && (column.min !== undefined || column.max !== undefined)) {
    const input = field.querySelector('input')
    const note = element('span', 'entry-range-note')
    const range = [column.min === undefined ? '' : 'от ' + column.min,
      column.max === undefined ? '' : 'до ' + column.max].filter(Boolean).join(' ')
    note.id = 'entry-range-' + id
    note.setAttribute('aria-live', 'polite')
    input.setAttribute('aria-describedby', note.id)
    function updateNote() {
      const outside = isOutsideNumberRange(column, input.value)
      note.textContent = outside ? 'Вне диапазона ' + range + '. Значение будет выделено.' : 'Диапазон ' + range
      note.classList.toggle('outside-range', outside)
    }
    input.addEventListener('input', updateNote)
    updateNote()
    field.append(note)
  }
  return field
}

function entryFieldWithSkip(column, field, onChange) {
  if (column.type === 'sequence') return { wrapper: field }
  const wrapper = element('div', 'entry-field')
  const controls = element('fieldset', 'entry-field-controls')
  controls.setAttribute('aria-label', column.name)
  controls.append(field)
  const label = element('label', 'entry-skip')
  const skip = element('input')
  skip.type = 'checkbox'
  skip.name = 'skip-' + column.id
  skip.setAttribute('aria-label', 'Поставить прочерк: ' + column.name)
  skip.addEventListener('change', () => {
    controls.disabled = skip.checked
    onChange()
  })
  label.append(skip, element('span', '', 'Поставить прочерк'))
  wrapper.append(controls, label)
  return { wrapper, skip }
}

async function readImage(file) {
  if (!file?.name) return null
  if (!imageTypes.includes(file.type) || !file.size) throw new Error('Выберите изображение PNG, JPEG, WebP, GIF или AVIF.')
  if (file.size > 1024 * 1024) throw new Error('Размер изображения должен быть не больше 1 МБ.')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve({ name: file.name, url: reader.result }))
    reader.addEventListener('error', () => reject(new Error('Не удалось прочитать изображение.')))
    reader.readAsDataURL(file)
  })
}

function entryValue(type, value, { locationName, employeeName }) {
  if (value === undefined || value === null || value === '') return '—'
  if (type === 'date' || type === 'next-date') return formatDate(value)
  if (type === 'location') return locationName(value)
  if (type === 'employee') return employeeName(value)
  if (type === 'boolean') return value ? 'Да' : 'Нет'
  return value
}

function openDraftSettings(journal, afterSave) {
  openJournalSettings('Редактирование черновика', journal,
    (fields) => updateJournalDraft(journal.id, fields), afterSave, {
      label: 'Сохранить черновик', skipValidation: true,
      alternate: { label: 'Активировать', save: (fields) => activateJournalDraft(journal.id, fields) },
    })
}

function openJournalEntry(journal, refs, afterSave) {
  const authorField = referenceField('Автор записи', 'authorUid', refs.employees, '', true)
  const author = authorField.querySelector('select')
  const fields = journal.columns.map((column) => ({
    column,
    ...entryFieldWithSkip(column, entryField(column, journal, refs, author), updateAuthor),
  }))
  function updateAuthor() {
    const needsAuthor = fields.some(({ column: { type, mode }, skip }) => !skip?.checked && (
      type === 'confirmation' || (mode === 'auto' && (type === 'employee' || type === 'location'))
    ))
    authorField.hidden = author.disabled = !needsAuthor
  }
  updateAuthor()
  openForm('Новая запись', [authorField, ...fields.map(({ wrapper }) => wrapper)], async (data, isOpen) => {
    const values = {}
    const skipped = []
    for (const { column: { id: key, type }, skip } of fields) {
      if (skip?.checked) {
        skipped.push(key)
        continue
      }
      const value = data[key]
      if (type === 'image') values[key] = await readImage(value)
      else if (!value) values[key] = null
      else if (type === 'number') values[key] = Number(value)
      else if (type === 'boolean') values[key] = value === 'yes'
      else values[key] = value
    }
    if (isOpen()) return addJournalEntry(journal.id, values, data.authorUid, skipped)
  }, afterSave)
}

function showJournalCompletion(journal, afterComplete) {
  const content = element('div', 'journal-form')
  const error = element('p', 'journal-form-error')
  error.setAttribute('role', 'alert')
  error.hidden = true
  const confirm = element('button', 'primary-button', 'Завершить')
  confirm.type = 'button'
  content.append(element('p', '', 'Журнал «' + journal.name
    + '» будет перенесён в архив и доступен для просмотра и печати.'), error, confirm)
  const dialog = showDialog('Завершить журнал?', content)
  confirm.addEventListener('click', () => {
    let updated
    try {
      updated = completeJournal(journal.id)
    } catch (problem) {
      error.textContent = problem.message || 'Не удалось завершить журнал.'
      error.hidden = false
      return
    }
    dialog.close()
    afterComplete(updated)
  })
}

function showDraftDeletion(journal, afterDelete) {
  const content = element('div', 'journal-form')
  const error = element('p', 'journal-form-error')
  error.setAttribute('role', 'alert')
  error.hidden = true
  const cancel = element('button', 'outline-button', 'Отмена')
  const confirm = element('button', 'primary-button', 'Удалить')
  cancel.type = confirm.type = 'button'
  const actions = element('div', 'journal-form-footer')
  actions.append(cancel, confirm)
  content.append(error, actions)
  const dialog = showDialog('Удалить черновик «' + journal.name + '»?', content)
  cancel.focus()
  cancel.addEventListener('click', () => dialog.close())
  confirm.addEventListener('click', () => {
    try {
      deleteJournalDraft(journal.id)
    } catch (problem) {
      error.textContent = problem.message || 'Не удалось удалить черновик.'
      error.hidden = false
      return
    }
    dialog.close()
    afterDelete()
  })
}

export function renderJournal(page, actionBar, id, navigate) {
  actionBar.append(routeLink('К журналам', '/journals', 'journal-back'))
  let journal
  try {
    journal = getJournals().find((item) => item.id === id)
  } catch {
    page.append(element('p', 'empty', 'Не удалось загрузить журнал из браузера.'))
    return
  }
  if (!journal) {
    document.title = 'Журнал не найден · Журналы контроля'
    page.append(element('p', 'empty', 'Этот журнал недоступен в текущем браузере.'))
    return
  }

  const refs = references()
  const meta = element('p', 'journal-meta')
  const cover = element('dl', 'detail-list')
  page.append(meta, cover)
  const { body, status } = journalTable(page, journal.columns.map(({ name }) => name), 'journal-records')
  const add = element('button', 'primary-button journal-action', 'Добавить запись')
  add.type = 'button'
  add.setAttribute('aria-haspopup', 'dialog')
  add.addEventListener('click', () => openJournalEntry(journal, refs, update))
  const finish = element('button', 'outline-button', 'Завершить журнал')
  finish.type = 'button'
  finish.setAttribute('aria-haspopup', 'dialog')
  finish.addEventListener('click', () => showJournalCompletion(journal, (updated) => {
    update(updated)
    page.focus()
  }))
  const print = element('button', 'outline-button journal-action', 'Печать')
  print.type = 'button'
  print.addEventListener('click', () => window.print())
  const edit = element('button', 'primary-button journal-action', 'Редактировать черновик')
  edit.type = 'button'
  edit.setAttribute('aria-haspopup', 'dialog')
  edit.addEventListener('click', () => openDraftSettings(journal, (updated) => {
    update(updated)
    if (updated.status === 'active') page.focus()
  }))
  const remove = element('button', 'outline-button journal-action', 'Удалить')
  remove.type = 'button'
  remove.setAttribute('aria-haspopup', 'dialog')
  remove.addEventListener('click', () => showDraftDeletion(journal, () => navigate('/journals')))
  actionBar.append(finish, add, print, remove, edit)

  function update(updated) {
    journal = updated
    const archived = isJournalArchived(journal)
    const active = journal.status === 'active'
    const draft = journal.status === 'draft'
    add.hidden = finish.hidden = !active
    print.hidden = !archived
    edit.hidden = !draft
    remove.hidden = !canDeleteJournalDraft(journal)
    meta.textContent = archived ? 'В архиве' : active ? 'Активный' : draft ? 'Черновик' : ''
    page.setAttribute('aria-label', journal.name)
    document.title = journal.name + ' · Журналы контроля'
    cover.replaceChildren()
    for (const [label, value] of [
      ['Название журнала', journal.name],
      ['Филиал', journal.locationName || journal.localLocationName || refs.locationName(journal.locationId)],
      ['Юр. лицо', journal.legalEntityName || '—'],
      ['Ответственный сотрудник', journal.employeeName || refs.employeeName(journal.employeeId)],
      ['Дата начала', journal.startDate ? formatDate(journal.startDate) : '—'],
      ['Периодичность', formatJournalSchedule(journal.schedule)],
    ]) cover.append(element('dt', '', label), element('dd', '', value))
    body.replaceChildren()
    for (const [index, entry] of journal.entries.entries()) {
      const row = body.insertRow()
      for (const column of journal.columns) {
        const { id: key, type } = column
        const cell = row.insertCell()
        const value = entry[key]
        if (type === 'sequence') {
          cell.textContent = entry[key] ?? index + 1
        } else if (entry.skippedColumns?.includes(key)) {
          cell.textContent = '—'
          cell.title = 'Поле пропущено'
        } else if (type === 'confirmation') {
          const signatures = Array.isArray(value) ? value : value ? [value] : []
          for (const signer of signatures) {
            cell.append(element('div', '', signer.fullName + ' · UID ' + signer.uid))
          }
          if (active && !isConfirmationComplete(value)) {
            const button = element('button', 'outline-button', 'Подтвердить')
            button.type = 'button'
            button.setAttribute('aria-haspopup', 'dialog')
            button.addEventListener('click', () => {
              const signers = employeeChoices(eligibleSigners(column, entry.authorUid, refs.members))
              openForm(column.name, [referenceField('Кто подтверждает', 'signerUid', signers, '', true)],
                ({ signerUid }) => confirmJournalEntry(id, entry.id, key, signerUid), update, { label: 'Подтвердить' })
            })
            cell.append(button)
          }
        } else if (type === 'image' && value && /^data:image\/(png|jpeg|webp|gif|avif);base64,/i.test(value.url)) {
          const image = element('img', 'journal-image')
          image.src = value.url
          image.alt = value.name
          cell.append(image)
        } else {
          cell.textContent = entryValue(type, value, refs)
          if (isOutsideNumberRange(column, value)) {
            cell.classList.add('outside-range')
            cell.append(element('span', 'entry-range-label', 'Вне диапазона'))
          }
        }
      }
    }
    status.textContent = journal.entries.length ? '' : 'Записей пока нет.'
  }

  update(journal)
}
