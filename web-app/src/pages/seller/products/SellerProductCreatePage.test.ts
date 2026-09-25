import { describe, expect, it } from 'vitest'
import { newProductIdempotencyKey } from './SellerProductCreatePage'

describe('newProductIdempotencyKey', () => {
  it('gives each new product creation attempt a different key', () => {
    const first = newProductIdempotencyKey()
    const second = newProductIdempotencyKey()

    expect(first).toBeTruthy()
    expect(second).toBeTruthy()
    expect(second).not.toBe(first)
  })
})
