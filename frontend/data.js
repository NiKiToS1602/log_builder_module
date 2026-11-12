const locations = [
  { id: 1, name: 'Клевер', status: 'active', address: 'ул. Ткачей, 17' },
  { id: 2, name: 'Основное', status: 'active', address: 'ул. Центральная, 12' },
  { id: 3, name: 'Северный', status: 'inactive', address: null },
]

const positions = [
  { id: 1, name: 'Старший бариста' },
  { id: 2, name: 'Бариста' },
  { id: 3, name: 'Администратор' },
]

const employees = [
  ['Сергеев Сергей Сергеевич', 1, 1],
  ['Иванова Анна Андреевна', 1, 2],
  ['Петров Алексей Олегович', 2, 2],
  ['Орлова Мария Игоревна', 1, 2],
  ['Устинов Николай Павлович', 2, 3],
  ['Васильева Елена Романовна', 2, 2],
  ['Смирнов Максим Дмитриевич', 1, 2],
  ['Волкова Ольга Андреевна', 2, 1],
].map(([fullName, locationId, positionId], index) => ({
  member_uid: '00000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'),
  full_name: fullName,
  primary_location: locations.find(({ id }) => id === locationId),
  primary_position: positions.find(({ id }) => id === positionId),
}))

export const directory = {
  getEmployees: () => employees.slice(),
  getLocations: () => locations.slice(),
  getPositions: () => positions.slice(),
}
