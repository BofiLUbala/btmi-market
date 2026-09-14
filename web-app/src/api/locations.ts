import { get } from './client'

export interface ProvinceOption { id: string; code: string; name: string; active: boolean }
export interface CityOption extends ProvinceOption { province_id: string }
export interface CommuneOption extends ProvinceOption { city_id: string }

/** Read-only RDC administrative hierarchy, seeded and owned by the backend. */
export const locationsApi = {
  provinces: () => get<{ items: ProvinceOption[] }>('/locations/provinces').then(r => r.items ?? []),
  cities: (provinceId: string) => get<{ items: CityOption[] }>(`/locations/provinces/${provinceId}/cities`).then(r => r.items ?? []),
  /** Flat country-wide list, for the single-city pickers with no province step. */
  allCities: () => get<{ items: CityOption[] }>('/locations/cities').then(r => r.items ?? []),
  communes: (cityId: string) => get<{ items: CommuneOption[] }>(`/locations/cities/${cityId}/communes`).then(r => r.items ?? [])
}
