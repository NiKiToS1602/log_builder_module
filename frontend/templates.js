import { journalDirectory } from './data.js'
import {
  columnTypes, confirmationRules, createTemplate, deleteTemplate, getTemplates,
  isTemplateArchived, setTemplateArchived, updateTemplate,
} from './journal-data.js'
import { inputField, journalTable, openJournalCreation } from './journals.js'
import { element, icon, rowActions, searchField, showDialog } from './ui.js'

function confirmTemplateAction(template, label, message, perform, onSuccess) {
  const content = element('div', 'journal-form')
  const error = element('p', 'journal-form-error')
  error.setAttribute('role', 'alert')
  error.hidden = true
  const cancel = element('button', 'outline-button', 'Отмена')
  const confirm = element('button', 'primary-button', label)
  cancel.type = confirm.type = 'button'
  const actions = element('div', 'template-confirm-actions')
  actions.append(cancel, confirm)
  content.append(element('p', '', message), error, actions)
  const dialog = showDialog(label + ' шаблон «' + template.name + '»?', content)
  cancel.focus()
  cancel.addEventListener('click', () => dialog.close())
  confirm.addEventListener('click', () => {
    let updated
    try {
      updated = perform()
    } catch {
      error.textContent = 'Не удалось изменить список шаблонов в браузере.'
      error.hidden = false
      return
    }
    dialog.close()
    onSuccess(updated)
  })
}

export function renderTemplates(page, actionBar, navigate) {
  const { wrapper: search, input } = searchField('Поиск по названию шаблона')
  const createTemplateButton = element('button', 'primary-button journal-action', 'Создать шаблон')
  createTemplateButton.type = 'button'
  createTemplateButton.setAttribute('aria-haspopup', 'dialog')
  actionBar.append(search, createTemplateButton)
  const categories = element('div', 'journal-categories')
  categories.setAttribute('role', 'group')
  categories.setAttribute('aria-label', 'Статус шаблона')
  page.append(categories)
  const { head, body, status } = journalTable(page, ['Название', 'Столбцы', 'Действия'], 'template-list')
  head.cells[2].replaceChildren(element('span', 'sr-only', 'Действия'))

  let templates
  try {
    templates = getTemplates()
  } catch {
    createTemplateButton.disabled = true
    status.textContent = 'Не удалось загрузить шаблоны из браузера.'
    return
  }

  let archived = false
  const activeButton = element('button', 'outline-button', 'Активные')
  const archiveButton = element('button', 'outline-button', 'Архив')
  for (const [button, showArchived] of [[activeButton, false], [archiveButton, true]]) {
    button.type = 'button'
    button.addEventListener('click', () => {
      archived = showArchived
      update()
    })
    categories.append(button)
  }

  function update() {
    activeButton.setAttribute('aria-pressed', String(!archived))
    archiveButton.setAttribute('aria-pressed', String(archived))
    const query = input.value.trim().toLocaleLowerCase('ru')
    const group = templates.filter((template) => isTemplateArchived(template) === archived)
    const visible = group.filter(({ name }) => name.toLocaleLowerCase('ru').includes(query))
    body.replaceChildren()
    for (const template of visible) {
      const row = body.insertRow()
      const name = row.insertCell()
      name.textContent = template.name
      if (template.description) name.append(element('p', 'template-description', template.description))
      const details = element('details', 'template-details')
      const summary = element('summary', '', 'Столбцов: ' + template.columns.length)
      const list = element('ol')
      for (const { name, type, required } of template.columns) {
        list.append(element('li', '', name + ' · ' + (columnTypes[type] ?? 'Да / нет') + (required ? ' · обязательный' : '')))
      }
      details.append(summary, list)
      row.insertCell().append(details)
      const actions = [['Редактировать', () => openTemplateBuilder(refreshList, template)]]
      if (archived) {
        actions.push(['Восстановить', () => {
          try {
            refreshAfterAction(template.id, setTemplateArchived(template.id, false))
          } catch {
            status.textContent = 'Не удалось восстановить шаблон в браузере.'
          }
        }, false])
      } else {
        actions.push(
          ['Создать журнал', () => openJournalCreation(template.id, navigate)],
          ['Архивировать', () => confirmTemplateAction(template, 'Архивировать',
            'Шаблон переместится в архив. Чтобы снова создавать из него журналы, восстановите его.',
            () => setTemplateArchived(template.id, true), (updated) => refreshAfterAction(template.id, updated))],
        )
      }
      actions.push(['Удалить', () => confirmTemplateAction(template, 'Удалить',
        'Шаблон будет удалён. Все созданные из него журналы, их структура и записи сохранятся.',
        () => deleteTemplate(template.id), () => refreshAfterAction(template.id))])
      row.append(rowActions('template-actions-' + template.id, 'Действия шаблона «' + template.name + '»', actions))
    }
    status.textContent = visible.length ? '' : group.length ? 'Шаблоны не найдены.'
      : archived ? 'В архиве пока нет шаблонов.' : 'Активных шаблонов пока нет.'
  }

  function refreshAfterAction(id, updated) {
    const index = templates.findIndex((template) => template.id === id)
    if (updated) templates[index] = updated
    else templates.splice(index, 1)
    update()
    const selectedCategory = archived ? archiveButton : activeButton
    selectedCategory.focus()
  }

  function refreshList(template) {
    const index = templates.findIndex(({ id }) => id === template.id)
    if (index === -1) {
      templates.push(template)
      archived = false
    } else templates[index] = template
    if (!template.name.toLocaleLowerCase('ru').includes(input.value.trim().toLocaleLowerCase('ru'))) {
      input.value = ''
    }
    update()
  }

  input.addEventListener('input', update)
  createTemplateButton.addEventListener('click', () => openTemplateBuilder(refreshList))
  update()
}

function selectSetting(label, name, choices) {
  const field = element('label', 'journal-field')
  const select = element('select')
  select.name = name
  for (const [value, title] of Object.entries(choices)) select.add(new Option(title, value))
  field.append(element('span', '', label), select)
  return field
}

function columnOptions(type, settings = {}) {
  const options = element('div', 'column-options')
  if (type === 'sequence') {
    options.append(element('p', 'empty', 'Номер заполняется автоматически.'))
    return options
  }
  if (type === 'confirmation') {
    const rule = selectSetting('Кто подтверждает', 'signerRule', confirmationRules)
    const ruleSelect = rule.querySelector('select')
    const ruleName = settings.signerRule
    ruleSelect.value = ruleName === 'manager' || ruleName === 'manager-and-owner'
      ? 'manager-or-owner' : ruleName ?? 'any'
    const signers = element('fieldset', 'entry-field-controls column-options')
    signers.append(element('legend', '', 'Сотрудники, которые могут подтвердить'))
    const selected = new Set(settings.signerUids ?? (settings.signerUid ? [settings.signerUid] : []))
    const choices = new Map(journalDirectory().employees.map(({ member_uid, full_name }) => [member_uid, full_name]))
    for (const uid of selected) {
      if (!choices.has(uid)) choices.set(uid, 'Сотрудник вне справочника · ' + uid)
    }
    for (const [uid, fullName] of choices) {
      const choice = element('label', 'entry-skip')
      const check = element('input')
      check.type = 'checkbox'
      check.name = 'signerUids'
      check.value = uid
      check.checked = selected.has(uid)
      choice.append(check, element('span', '', fullName))
      signers.append(choice)
    }
    function updateSigners() {
      signers.hidden = signers.disabled = ruleSelect.value !== 'specific'
    }
    ruleSelect.addEventListener('change', updateSigners)
    updateSigners()
    const mode = selectSetting('Когда подтверждает', 'mode', {
      inline: 'При внесении записи',
      later: 'После сохранения записи',
    })
    mode.querySelector('select').value = settings.mode ?? 'inline'
    options.append(rule, signers, mode)
    return options
  }

  const requiredField = element('label', 'builder-required')
  const required = element('input', 'column-required')
  required.type = 'checkbox'
  required.checked = Boolean(settings.required)
  requiredField.append(required, element('span', '', type === 'image' ? 'Обязательная загрузка' : 'Обязательное заполнение'))
  options.append(requiredField)
  if (type === 'next-date') {
    options.append(element('p', 'empty entry-hint', 'Дата из последней записи появится в графике журнала.'))
  }
  if (type === 'text' || type === 'number') {
    options.append(inputField('Пример в пустом поле', 'placeholder', 'text', { required: false, maxlength: '120' }))
  }
  if (type === 'number') {
    const range = element('div', 'builder-range')
    const attributes = { step: 'any', required: false }
    range.append(
      inputField('Минимум', 'min', 'number', attributes),
      inputField('Максимум', 'max', 'number', attributes),
    )
    options.append(range)
  }
  const automatic = { date: 'Текущая дата', employee: 'Автор записи', location: 'Основной филиал автора' }
  if (Object.hasOwn(automatic, type)) {
    options.append(selectSetting('Заполнение', 'mode', { manual: 'Вручную', auto: automatic[type] }))
  }
  for (const control of options.querySelectorAll('[name]')) {
    if (settings[control.name] !== undefined) control.value = settings[control.name]
  }
  return options
}

function openTemplateBuilder(onSave, template) {
  const form = element('form', 'builder-form')
  const nameField = inputField('Название шаблона', 'name', 'text', {
    maxlength: '120',
    placeholder: 'Впишите название шаблона',
  })
  const name = nameField.querySelector('input')
  name.value = template?.name ?? ''
  nameField.firstElementChild.classList.add('sr-only')
  const descriptionField = element('label', 'journal-field')
  const description = element('textarea')
  description.name = 'description'
  description.rows = 3
  description.value = template?.description ?? ''
  descriptionField.append(element('span', '', 'Описание'), description)
  const columns = element('ol', 'builder-columns')
  columns.setAttribute('aria-label', 'Столбцы шаблона')
  const add = element('button', 'primary-button builder-add', '+')
  add.type = 'button'
  add.setAttribute('aria-label', 'Добавить столбец')
  const editor = element('div', 'builder-editor')
  editor.append(columns, add)
  const save = element('button', 'outline-button', 'Сохранить шаблон')
  save.type = 'submit'
  const actions = element('div', 'builder-actions')
  actions.append(save)
  const error = element('p', 'journal-form-error')
  error.setAttribute('role', 'alert')
  error.hidden = true
  const preview = element('div', 'builder-preview')
  const previewScroll = element('div', 'table-scroll')
  const table = element('table', 'journal-table journal-records')
  const previewHeader = table.createTHead().insertRow()
  table.setAttribute('aria-label', 'Предпросмотр таблицы')
  previewScroll.append(table)
  preview.append(element('h3', 'section-title', 'Предпросмотр таблицы'), previewScroll)
  form.append(nameField, descriptionField)
  if (template) form.append(element('p', 'empty entry-hint', 'Изменения применятся к новым журналам.'))
  form.append(editor, preview, error, actions)

  function updatePreview() {
    const rows = Array.from(columns.children)
    previewHeader.replaceChildren(...rows.map((row, index) => {
      const input = row.querySelector('.column-name')
      const label = input.disabled ? '№' : input.value.trim() || 'Столбец ' + (index + 1)
      const th = element('th', '', label)
      th.scope = 'col'
      return th
    }))
    rows.forEach((row, index) => {
      row.querySelector('.move-up').disabled = index === 0
      row.querySelector('.move-down').disabled = index === rows.length - 1
      row.querySelector('.remove-column').disabled = rows.length === 1
    })
  }

  function addColumn(column = {}, focus = true) {
    const row = element('li', 'builder-column')
    if (column.id) row.dataset.columnId = column.id
    const label = inputField('Название столбца', '', 'text', {
      maxlength: '80',
      placeholder: 'Впишите название столбца',
    })
    label.firstElementChild.classList.add('sr-only')
    const input = label.querySelector('input')
    input.className = 'column-name'
    input.value = column.type === 'sequence' ? '' : column.name ?? ''
    const typeField = element('label', 'journal-field')
    const type = element('select', 'column-type')
    for (const [id, title] of Object.entries(columnTypes)) type.add(new Option(title, id))
    if (column.type === 'boolean') type.add(new Option('Да / нет', 'boolean'))
    if (column.type) type.value = column.type
    const typeControl = element('span', 'filter-field builder-type-control')
    typeControl.append(type, icon('select-arrow'))
    typeField.append(element('span', '', 'Тип данных'), typeControl)
    const options = element('div', 'builder-options')
    function updateOptions(settings) {
      input.disabled = type.value === 'sequence'
      input.setCustomValidity('')
      input.placeholder = input.disabled ? '№' : 'Впишите название столбца'
      options.replaceChildren(columnOptions(type.value, settings))
      updatePreview()
    }
    type.addEventListener('change', () => updateOptions())

    const controls = element('div', 'builder-column-actions')
    const up = element('button', 'outline-button move-up', '←')
    const down = element('button', 'outline-button move-down', '→')
    const remove = element('button', 'outline-button remove-column', 'Удалить')
    up.type = down.type = remove.type = 'button'
    up.setAttribute('aria-label', 'Переместить столбец влево')
    down.setAttribute('aria-label', 'Переместить столбец вправо')
    remove.setAttribute('aria-label', 'Удалить столбец')
    up.addEventListener('click', () => {
      row.previousElementSibling.before(row)
      updatePreview()
      const control = input.disabled ? type : input
      control.focus()
    })
    down.addEventListener('click', () => {
      row.nextElementSibling.after(row)
      updatePreview()
      const control = input.disabled ? type : input
      control.focus()
    })
    remove.addEventListener('click', () => {
      const neighbor = row.nextElementSibling ?? row.previousElementSibling
      row.remove()
      updatePreview()
      neighbor.querySelector('.column-name:not(:disabled), .column-type').focus()
    })
    controls.append(up, down, remove)
    const settings = element('div', 'builder-settings')
    settings.append(typeField)
    row.append(label, settings, options, controls)
    columns.append(row)
    updateOptions(column)
    if (focus) (input.disabled ? type : input).focus()
  }

  add.addEventListener('click', () => addColumn())
  form.addEventListener('input', (event) => {
    event.target.setCustomValidity('')
    if (event.target.matches('.column-name')) updatePreview()
  })
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    error.hidden = true
    for (const input of form.querySelectorAll('input[type=text]:required:not(:disabled)')) {
      if (input.value.trim()) continue
      input.setCustomValidity('Заполните это поле.')
      input.reportValidity()
      return
    }

    const fields = []
    for (const row of columns.children) {
      const field = {
        id: row.dataset.columnId,
        name: row.querySelector('.column-name').value,
        type: row.querySelector('.column-type').value,
        required: row.querySelector('.column-required')?.checked ?? false,
      }
      for (const control of row.querySelectorAll('.column-options [name]:not([type=checkbox]):enabled')) {
        if (control.value.trim()) {
          field[control.name] = control.type === 'number' ? control.valueAsNumber : control.value.trim()
        }
      }
      if (field.signerRule === 'specific') {
        field.signerUids = Array.from(row.querySelectorAll('input[name=signerUids]:checked'), ({ value }) => value)
        if (!field.signerUids.length) {
          error.textContent = 'Выберите хотя бы одного сотрудника для столбца «' + field.name.trim() + '».'
          error.hidden = false
          return
        }
      }
      if (field.min > field.max) {
        error.textContent = 'Минимум не может быть больше максимума в столбце «' + field.name.trim() + '».'
        error.hidden = false
        return
      }
      fields.push(field)
    }
    let savedTemplate
    try {
      savedTemplate = template
        ? updateTemplate(template.id, name.value, fields, description.value)
        : createTemplate(name.value, fields, description.value)
    } catch {
      error.textContent = 'Не удалось сохранить шаблон в браузере.'
      error.hidden = false
      return
    }
    dialog.close()
    onSave(savedTemplate)
  })
  for (const column of template?.columns ?? [{}]) addColumn(column, false)
  const dialog = showDialog(template ? 'Редактировать шаблон' : 'Конструктор', form, 'template-builder')
  name.focus()
}
