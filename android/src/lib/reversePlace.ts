import type { StructuredAddressValue } from '../components/StructuredAddressFields'
import type { ReversePlace } from '../types'

/** Beyond this the matched house is a neighbour's, not the pin's door. */
const BUILDING_MAX_OFFSET_M = 25
/** Beyond this the matched street may be the next one over. */
const STREET_MAX_OFFSET_M = 150

const blank = (id: string, name: string) => !id && !name.trim()

/**
 * What the place under the pin can add to the form, filling only what the
 * person left empty. Province, city and commune are taken as a chain: a city is
 * only offered inside the province already chosen (or the one being filled),
 * so a hand-picked province never ends up with another province's city.
 * Returns null when there is nothing to add.
 */
export function fillFromPlace(current: StructuredAddressValue, place: ReversePlace): StructuredAddressValue | null {
  const next = { ...current }
  let changed = false

  let provinceOk = false
  if (place.province_id) {
    if (blank(current.province_id, current.province)) {
      next.province_id = place.province_id; next.province = place.province
      changed = true; provinceOk = true
    } else provinceOk = current.province_id === place.province_id
  }
  let cityOk = false
  if (provinceOk && place.city_id) {
    if (blank(current.city_id, current.city)) {
      next.city_id = place.city_id; next.city = place.city
      changed = true; cityOk = true
    } else cityOk = current.city_id === place.city_id
  }
  if (cityOk && place.commune_id && blank(current.commune_id, current.commune)) {
    next.commune_id = place.commune_id; next.commune = place.commune
    changed = true
  }

  if (!current.street.trim() && place.street && place.offset_m <= STREET_MAX_OFFSET_M) {
    next.street = place.street; changed = true
  }
  if (!current.building_number.trim() && place.building_number && place.offset_m <= BUILDING_MAX_OFFSET_M) {
    next.building_number = place.building_number; changed = true
  }
  return changed ? next : null
}

/** One line naming the place, for under the map. */
export function placeLine(place: ReversePlace): string {
  return place.label || [[place.building_number, place.street].filter(Boolean).join(' '), place.commune, place.city].filter(Boolean).join(', ')
}
