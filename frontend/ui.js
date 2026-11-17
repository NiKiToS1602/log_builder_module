export function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

export function icon(name) {
  const image = element('img', 'icon')
  image.src = '/assets/' + name + '.svg'
  image.alt = ''
  return image
}

export function searchField(label, disabled = false) {
  const wrapper = element('label', 'search-field')
  const input = element('input')
  input.type = 'search'
  input.placeholder = 'Поиск'
  input.setAttribute('aria-label', label)
  input.disabled = disabled
  wrapper.append(icon('search'), input)
  return { wrapper, input }
}

export function filterSelect(label, choices, disabled = choices.length === 0) {
  const wrapper = element('label', 'filter-field')
  const select = element('select', 'filter')
  select.setAttribute('aria-label', label)
  select.add(new Option(label, ''))
  for (const { id, name } of choices) select.add(new Option(name, String(id)))
  select.disabled = disabled
  wrapper.append(select, icon('select-arrow'))
  return { wrapper, select }
}

export function rowActions(id, label, choices) {
  const trigger = element('button', 'row-actions-trigger', '⋮')
  trigger.type = 'button'
  trigger.setAttribute('aria-label', label)
  const actions = element('div', 'row-actions')
  actions.id = id
  actions.setAttribute('popover', 'auto')
  trigger.setAttribute('popovertarget', id)

  for (const [label, perform, opensDialog = true] of choices) {
    const button = element('button', '', label)
    button.type = 'button'
    if (opensDialog) button.setAttribute('aria-haspopup', 'dialog')
    button.addEventListener('click', () => {
      actions.hidePopover()
      trigger.focus()
      perform()
    })
    actions.append(button)
  }
  actions.firstElementChild.autofocus = true
  const cell = element('td', 'row-action-cell')
  cell.append(trigger, actions)
  return cell
}

export function showDialog(title, content, variant = '') {
  const dialog = document.querySelector('dialog')
  dialog.dataset.variant = variant
  dialog.querySelector('h2').textContent = title
  dialog.querySelector('.dialog-body').replaceChildren(content)
  dialog.showModal()
  return dialog
}
