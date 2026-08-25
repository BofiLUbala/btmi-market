export interface LocationOption {
  value: string
  label: string
}

// Provincial capitals and the main commercial cities currently served in the DRC.
export const DRC_CITIES = [
  'Kinshasa',
  'Bandundu',
  'Baraka',
  'Beni',
  'Boende',
  'Bukavu',
  'Bunia',
  'Bumba',
  'Buta',
  'Butembo',
  'Gbadolite',
  'Gemena',
  'Goma',
  'Inongo',
  'Isiro',
  'Kabinda',
  'Kalemie',
  'Kamina',
  'Kananga',
  'Kenge',
  'Kikwit',
  'Kindu',
  'Kisangani',
  'Kolwezi',
  'Likasi',
  'Lisala',
  'Lodja',
  'Lubumbashi',
  'Lusambo',
  'Matadi',
  'Mbandaka',
  'Mbuji-Mayi',
  'Muanda',
  'Tshikapa',
  'Uvira',
  'Zongo',
] as const

export const KINSHASA_COMMUNES = [
  'Bandalungwa',
  'Barumbu',
  'Bumbu',
  'Gombe',
  'Kalamu',
  'Kasa-Vubu',
  'Kimbanseke',
  'Kinshasa',
  'Kintambo',
  'Kisenso',
  'Lemba',
  'Limete',
  'Lingwala',
  'Makala',
  'Maluku',
  'Masina',
  'Matete',
  'Mont-Ngafula',
  "N'Djili",
  "N'Sele",
  'Ngaba',
  'Ngaliema',
  'Ngiri-Ngiri',
  'Selembao',
] as const

export const isKinshasa = (city: string) => city.trim().toLocaleLowerCase() === 'kinshasa'

function optionsWithCurrent(values: readonly string[], current = ''): LocationOption[] {
  const options = values.map((value) => ({ value, label: value }))
  const trimmed = current.trim()
  if (trimmed && !values.some((value) => value.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
    options.push({ value: current, label: current })
  }
  return options
}

export const drcCityOptions = (current = ''): LocationOption[] => [
  { value: '', label: 'Select a city' },
  ...optionsWithCurrent(DRC_CITIES, current),
]

export const kinshasaCommuneOptions = (current = ''): LocationOption[] => [
  { value: '', label: 'Select a commune' },
  ...optionsWithCurrent(KINSHASA_COMMUNES, current),
]
