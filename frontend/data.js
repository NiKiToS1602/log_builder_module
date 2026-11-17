export const directory = {
  getEmployees: () => [],
  getLocations: () => [],
  getPositions: () => [],
}

const demoLocations = [
  { id: 'demo-north', name: 'Северный (демо)', legal_entity: { name: 'ООО «Север» (демо)' } },
  { id: 'demo-south', name: 'Южный (демо)', legal_entity: { name: 'ООО «Юг» (демо)' } },
]

export function journalDirectory() {
  const locations = directory.getLocations()
  const employees = directory.getEmployees()
  if (locations.length || employees.length) return { locations, employees }
  return {
    locations: demoLocations,
    employees: [
      { member_uid: '10000000-0000-4000-8000-000000000001', full_name: 'Анна Смирнова (демо)', role: 'employee', primary_location: demoLocations[0] },
      { member_uid: '10000000-0000-4000-8000-000000000002', full_name: 'Иван Петров (демо)', role: 'manager', primary_location: demoLocations[0] },
      { member_uid: '10000000-0000-4000-8000-000000000003', full_name: 'Мария Волкова (демо)', role: 'employee', primary_location: demoLocations[1] },
      { member_uid: '10000000-0000-4000-8000-000000000004', full_name: 'Олег Соколов (демо)', role: 'owner', primary_location: null },
    ],
  }
}
