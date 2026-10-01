import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createFruitModel } from './FruitModelFactory'
import { FRUIT_CATALOG } from './fruitCatalog'

function largestDimension(object) {
  object.updateMatrixWorld(true)
  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3())
  return Math.max(size.x, size.y, size.z)
}

describe('fruit visual scale', () => {
  it('assigns fixed A/B/C visual tiers based on real fruit size', () => {
    expect(FRUIT_CATALOG.watermelon.sizeTier).toBe('A')
    expect(FRUIT_CATALOG.cantaloupe.sizeTier).toBe('A')
    expect(FRUIT_CATALOG.pineapple.sizeTier).toBe('B')
    expect(FRUIT_CATALOG.banana.sizeTier).toBe('B')
    expect(FRUIT_CATALOG.dragonfruit.sizeTier).toBe('B')
    expect(FRUIT_CATALOG.apple.sizeTier).toBe('B')
    expect(FRUIT_CATALOG.kiwi.sizeTier).toBe('C')
    expect(FRUIT_CATALOG.strawberry.sizeTier).toBe('C')
    expect(new Set(Object.values(FRUIT_CATALOG).map((fruit) => fruit.scale)).size).toBe(3)
  })

  it('keeps large fruit below the board-obscuring size limit', () => {
    expect(largestDimension(createFruitModel('watermelon'))).toBeLessThanOrEqual(1.16)
    expect(largestDimension(createFruitModel('cantaloupe'))).toBeLessThanOrEqual(1.16)
  })
})
