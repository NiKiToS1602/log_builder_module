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

export function filterSelect(label, choices, disabled = false) {
  const wrapper = element('label', 'filter-field')
  const select = element('select', 'filter')
  select.setAttribute('aria-label', label)
  select.add(new Option(label, ''))
  for (const { id, name } of choices) select.add(new Option(name, String(id)))
  select.disabled = disabled
  wrapper.append(select, icon('select-arrow'))
  return { wrapper, select }
}

export function showDialog(title, content) {
  const dialog = document.querySelector('dialog')
  dialog.querySelector('h2').textContent = title
  dialog.querySelector('.dialog-body').replaceChildren(content)
  dialog.showModal()
}
