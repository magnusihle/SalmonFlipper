import { expect, it } from 'vitest'
import { SEED } from './seed'

it('seed loads with the counts from issue #1', () => {
  expect(SEED.edges.length).toBe(20)
  expect(SEED.products.length).toBe(15)
  expect(SEED.orders.length).toBe(8)
  expect(SEED.supply.length).toBe(2)
})
