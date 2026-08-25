import { get, post } from './client'
import type { Business, BuyerProfile, Category, LoginResponse, ProductDetail, PublicProduct, Shop, User } from '../types'

const list = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  const object = value as Record<string, unknown> | null
  for (const key of ['data', 'products', 'shops', 'categories', 'items']) if (Array.isArray(object?.[key])) return object![key] as T[]
  return []
}

export const authApi = {
  login: (email: string, password: string) => post<LoginResponse>('/auth/login', { email, password }),
  me: () => get<User>('/auth/me'),
  logout: () => post('/auth/logout'),
}
export const marketplaceApi = {
  products: async () => list<PublicProduct>(await get<unknown>('/marketplace/products?page=1&limit=20')),
  categories: async () => list<Category>(await get<unknown>('/marketplace/categories')),
  shops: async () => list<Shop>(await get<unknown>('/marketplace/shops?page=1&limit=20')),
  search: async (query: string) => list<PublicProduct>(await get<unknown>(`/marketplace/search?q=${encodeURIComponent(query)}`)),
  categoryProducts: async (slug: string) => list<PublicProduct>(await get<unknown>(`/marketplace/categories/${encodeURIComponent(slug)}/products?page=1&limit=30`)),
  product: (id: string) => get<ProductDetail>(`/marketplace/products/${id}/detail`),
}
export const buyerApi = {
  profile: async () => (await get<{ profile: BuyerProfile }>('/buyer/profile')).profile,
  points: () => get<unknown>('/buyer/points'),
  orders: () => get<unknown>('/buyer/orders'),
}
export const sellerApi = {
  businesses: async () => list<Business>(await get<unknown>('/businesses')),
}
