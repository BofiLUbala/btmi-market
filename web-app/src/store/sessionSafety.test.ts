import { describe, expect, it } from 'vitest'
import { isAdminRoute } from './auth'
import { parsePersistedFavorites } from './favorites'

describe('session hydration safety', () => {
  it('recognizes every admin control-center route', () => {
    expect(isAdminRoute('/admin')).toBe(true)
    expect(isAdminRoute('/admin/login')).toBe(true)
    expect(isAdminRoute('/admin/direction')).toBe(true)
    expect(isAdminRoute('/login')).toBe(false)
    expect(isAdminRoute('/administrator')).toBe(false)
  })

  it('treats null or malformed persisted favorites as an empty array', () => {
    expect(parsePersistedFavorites(null)).toEqual([])
    expect(parsePersistedFavorites('null')).toEqual([])
    expect(parsePersistedFavorites('{}')).toEqual([])
  })

  it('keeps valid persisted favorites', () => {
    const favorite = { productId: 'product-1' }
    expect(parsePersistedFavorites(JSON.stringify([favorite]))).toEqual([favorite])
  })
})
