import { journalDirectory } from './data.js'
import { isJournalDate, localDate, normalizeJournalSchedule } from './journal-schedule.js'

const journalKey = 'clearbarn.control-logs.journals'
const templateKey = 'clearbarn.control-logs.templates'

export const columnTypes = {
  sequence: 'Порядковый номер',
  text: 'Текст',
  number: 'Число',
  date: 'Дата',
  'next-date': 'Дата следующей записи',
  employee: 'Сотрудник',
  location: 'Филиал',
  image: 'Изображение',
  confirmation: 'Подтверждение',
}

export const confirmationRules = {
  any: 'Любой сотрудник',
  author: 'Автор записи',
  other: 'Сотрудник, кроме автора',
  'manager-only': 'Менеджер',
  owner: 'Руководитель',
  'manager-or-owner': 'Менеджер или руководитель',
  specific: 'Выбранные сотрудники',
}

export function eligibleSigners(column, authorUid, employees) {
  switch (column.signerRule) {
    case 'author': return employees.filter(({ member_uid }) => member_uid === authorUid)
    case 'other': return employees.filter(({ member_uid }) => member_uid !== authorUid)
    case 'manager-only': return employees.filter(({ role }) => role === 'manager')
    case 'owner': return employees.filter(({ role }) => role === 'owner')
    case 'manager':
    case 'manager-and-owner':
    case 'manager-or-owner':
      return employees.filter(({ role }) => role === 'manager' || role === 'owner')
    case 'specific': {
      const uids = new Set(column.signerUids ?? [column.signerUid])
      return employees.filter(({ member_uid }) => uids.has(member_uid))
    }
    default: return employees
  }
}

export function isConfirmationComplete(value) {
  // Existing journals can contain an array of signatures from the former two-signer rule.
  return Array.isArray(value) ? value.length > 0 : Boolean(value)
}

function confirmation(column, authorUid, signerUid, employees) {
  const signer = eligibleSigners(column, authorUid, employees).find(({ member_uid }) => member_uid === signerUid)
  if (!signer) throw new Error('Выбранный сотрудник не может подтвердить запись.')
  return { uid: signer.member_uid, fullName: signer.full_name, role: signer.role, confirmedAt: new Date().toISOString() }
}

const legacyColumns = [
  { id: 'number', name: 'Номер', type: 'text', required: true },
  { id: 'date', name: 'Дата', type: 'date', required: true },
  { id: 'locationId', name: 'Филиал', type: 'location', required: false },
  { id: 'employeeId', name: 'Ответственный', type: 'employee', required: false },
  { id: 'temperature', name: 'Температура', type: 'number', required: true },
]

function readList(key) {
  const value = localStorage.getItem(key)
  if (value === null) return []
  const items = JSON.parse(value)
  if (!Array.isArray(items)) throw new Error('Invalid control log storage')
  return items
}

export function getTemplates() {
  return readList(templateKey)
}

export function isTemplateArchived({ status }) {
  return status === 'archived'
}

function templateFields(name, columns, description, previousColumns = []) {
  const previousTypes = new Map(previousColumns.map(({ id, type }) => [id, type]))
  const fields = {
    name: name.trim(),
    description: description.trim(),
    columns: columns.map(({ id, name, type, ...settings }) => ({
      ...settings,
      id: previousTypes.has(id) ? id : crypto.randomUUID(),
      name: type === 'sequence' ? '№' : name.trim(),
      type,
    })),
  }
  if (!fields.name || !fields.columns.length || fields.columns.some(
    (column) => !column.name
      || (!Object.hasOwn(columnTypes, column.type)
        && !(column.type === 'boolean' && previousTypes.get(column.id) === 'boolean'))
      || (column.signerRule === 'specific' && !column.signerUids?.length && !column.signerUid),
  )) throw new Error('Invalid template')
  return fields
}

export function createTemplate(name, columns, description = '') {
  const templates = getTemplates()
  const template = { id: crypto.randomUUID(), status: 'active', ...templateFields(name, columns, description) }
  localStorage.setItem(templateKey, JSON.stringify([...templates, template]))
  return template
}

function changeTemplate(id, change) {
  const templates = getTemplates()
  const index = templates.findIndex((template) => template.id === id)
  if (index < 0) throw new Error('Шаблон больше недоступен.')
  const template = change(templates[index])
  if (template) templates[index] = template
  else templates.splice(index, 1)
  localStorage.setItem(templateKey, JSON.stringify(templates))
  return template
}

export function updateTemplate(id, name, columns, description) {
  return changeTemplate(id, (current) => ({
    ...current,
    ...templateFields(name, columns, description ?? current.description ?? '', current.columns),
  }))
}

export function setTemplateArchived(id, archived) {
  return changeTemplate(id, (template) => ({ ...template, status: archived ? 'archived' : 'active' }))
}

export function deleteTemplate(id) {
  changeTemplate(id, () => null)
}

export function getJournals() {
  return readList(journalKey).map((journal) => ({
    status: 'active',
    ...journal,
    columns: journal.columns ?? legacyColumns.map((column) => ({ ...column })),
  }))
}

export function isJournalArchived({ status }) {
  return status === 'archived' || status === 'completed'
}

export function canDeleteJournalDraft({ status, entries, assignments }) {
  return status === 'draft' && entries?.length === 0 && !assignments?.length
}

export function deleteJournalDraft(id) {
  const journals = readList(journalKey)
  const index = journals.findIndex((journal) => journal.id === id)
  if (index < 0) throw new Error('Этот журнал больше недоступен.')
  if (!canDeleteJournalDraft(journals[index])) {
    throw new Error('Удалить можно только черновик без записей и назначений.')
  }
  journals.splice(index, 1)
  localStorage.setItem(journalKey, JSON.stringify(journals))
}

export function getTemplateForJournal(templateId) {
  const template = getTemplates().find(({ id }) => id === templateId)
  if (!template) throw new Error('Шаблон больше недоступен.')
  if (isTemplateArchived(template)) throw new Error('Шаблон в архиве. Восстановите его, чтобы создать журнал.')
  return template
}

export function createJournal(templateId, fields) {
  return saveJournal(templateId, fields, 'active')
}

export function saveJournalDraft(templateId, fields) {
  return saveJournal(templateId, fields, 'draft')
}

function saveJournal(templateId, fields, status) {
  const template = getTemplateForJournal(templateId)
  const journals = getJournals()
  const journal = {
    ...journalSettings(fields, status === 'active'),
    id: crypto.randomUUID(),
    templateId,
    columns: structuredClone(template.columns),
    status,
    entries: [],
  }
  localStorage.setItem(journalKey, JSON.stringify([...journals, journal]))
  return journal
}

function journalSettings({ name, locationId, employeeId, startDate, schedule }, active) {
  const { locations, employees } = journalDirectory()
  const location = locations.find(({ id }) => String(id) === String(locationId))
  const employee = employees.find(({ member_uid }) => member_uid === employeeId)
  const legalEntityName = location?.legal_entity?.name?.trim()
  const journalName = name?.trim()
  if (!journalName) throw new Error('Укажите название журнала.')
  if ((active || locationId) && !location) throw new Error('Выберите филиал.')
  if (active && !legalEntityName) throw new Error('Для выбранного филиала в справочнике не указано юр. лицо.')
  if ((active || employeeId) && !employee) throw new Error('Выберите ответственного сотрудника.')
  if ((active || startDate) && !isJournalDate(startDate)) {
    throw new Error('Укажите корректную дату начала ведения журнала.')
  }

  return {
    name: journalName,
    locationId: location ? String(location.id) : undefined,
    locationName: location?.name,
    legalEntityName,
    employeeId: employee?.member_uid,
    employeeName: employee?.full_name,
    startDate,
    schedule: normalizeJournalSchedule(schedule, startDate),
  }
}

export function updateJournalDraft(id, fields) {
  return updateJournal(id, (journal) => {
    Object.assign(journal, journalSettings(fields, false))
  }, 'draft')
}

export function activateJournalDraft(id, fields) {
  return updateJournal(id, (journal, journals) => {
    const settings = journalSettings(fields, true)
    if (!journal.columns.length) throw new Error('Для активации журнала нужно хотя бы одно поле.')
    const name = settings.name.toLocaleLowerCase('ru')
    if (journals.some((other) => other.id !== id && !isJournalArchived(other)
      && other.name.trim().toLocaleLowerCase('ru') === name)) {
      throw new Error('Журнал с таким названием уже есть.')
    }
    Object.assign(journal, settings, { status: 'active' })
  }, 'draft')
}

function updateJournal(id, update, expectedStatus = 'active') {
  const journals = getJournals()
  const journal = journals.find((item) => item.id === id)
  if (!journal) throw new Error('Этот журнал больше недоступен.')
  if (journal.status !== expectedStatus) {
    throw new Error(expectedStatus === 'draft' ? 'Этот журнал уже не черновик.' : 'Журнал доступен только для просмотра.')
  }
  update(journal, journals)
  localStorage.setItem(journalKey, JSON.stringify(journals))
  return journal
}

export function isOutsideNumberRange(column, value) {
  if (column.type !== 'number' || value === null || value === undefined || value === '') return false
  const number = Number(value)
  return Number.isFinite(number) && (number < column.min || number > column.max)
}

export function addJournalEntry(id, values, authorUid, skippedColumns = []) {
  const { employees } = journalDirectory()
  const author = employees.find(({ member_uid }) => member_uid === authorUid)
  return updateJournal(id, (journal) => {
    const skipped = new Set(journal.columns
      .filter(({ id, type }) => type !== 'sequence' && skippedColumns.includes(id))
      .map(({ id }) => id))
    const entry = {
      id: crypto.randomUUID(),
      authorUid,
      skippedColumns: [...skipped],
    }
    for (const column of journal.columns) {
      const { id: key, type, mode, required } = column
      if (skipped.has(key)) {
        entry[key] = null
        continue
      }
      let value = values[key] ?? null
      if (type === 'sequence') value = journal.entries.length + 1
      if (type === 'date' && mode === 'auto') value = localDate(new Date())
      if (type === 'employee' && mode === 'auto') value = author?.member_uid ?? null
      if (type === 'location' && mode === 'auto') value = author?.primary_location?.id ?? null
      if (type === 'confirmation') {
        if (!author) throw new Error('Укажите сотрудника, который вносит запись.')
        value = mode === 'later' ? null : confirmation(column, authorUid, value, employees)
      }
      if (value === null || value === '') {
        if (required) throw new Error('Заполните поле «' + column.name + '».')
      } else if (type === 'next-date' && !isJournalDate(value)) {
        throw new Error('Укажите корректную дату следующей записи.')
      } else if (type === 'number' && !Number.isFinite(value)) {
        throw new Error('Укажите корректное число в поле «' + column.name + '».')
      }
      entry[key] = value
    }
    journal.entries.push(entry)
  })
}

export function confirmJournalEntry(id, entryId, columnId, signerUid) {
  return updateJournal(id, (journal) => {
    const entry = journal.entries.find((item) => item.id === entryId)
    const column = journal.columns.find((item) => item.id === columnId)
    if (!entry || column?.type !== 'confirmation' || column.mode !== 'later'
      || isConfirmationComplete(entry[columnId]) || entry.skippedColumns?.includes(columnId)) {
      throw new Error('Это поле больше недоступно для подтверждения.')
    }
    entry[columnId] = confirmation(column, entry.authorUid, signerUid, journalDirectory().employees)
  })
}

export function completeJournal(id) {
  return updateJournal(id, (journal) => {
    const confirmations = journal.columns.filter(({ type }) => type === 'confirmation')
    if (journal.entries.some((entry) => confirmations.some(({ id }) => (
      !isConfirmationComplete(entry[id]) && !entry.skippedColumns?.includes(id)
    )))) {
      throw new Error('Подтвердите все записи перед завершением журнала.')
    }
    journal.status = 'archived'
    journal.completedDate = localDate(new Date())
  })
}
