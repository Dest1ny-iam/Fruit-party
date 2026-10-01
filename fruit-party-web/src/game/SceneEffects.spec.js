import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createFruitModel } from './FruitModelFactory'
import { createJuiceEffect } from './SceneEffects'

function largestDimension(object) {
  object.updateMatrixWorld(true)
  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3())
  return Math.max(size.x, size.y, size.z)
}

describe('fruit cut geometry', () => {
  it('keeps each sliced half visually aligned with its whole fruit size', () => {
    for (const type of ['apple', 'orange', 'watermelon', 'banana', 'pineapple', 'kiwi', 'strawberry', 'dragonfruit', 'cantaloupe', 'pear']) {
      const whole = createFruitModel(type)
      const effect = createJuiceEffect(new THREE.Vector3(), type)
      const halves = effect.getObjectByName('sliced-halves').children
      const wholeSize = largestDimension(whole)

      halves.forEach((half) => {
        const ratio = largestDimension(half) / wholeSize
        expect(ratio, `${type} cut half / whole fruit size`).toBeGreaterThanOrEqual(0.98)
        expect(ratio, `${type} cut half / whole fruit size`).toBeLessThanOrEqual(1.02)
      })
    }
  })

  it('keeps cut faces stable while the halves fly apart', () => {
    const effect = createJuiceEffect(new THREE.Vector3(), 'apple', 0)
    const halves = effect.getObjectByName('sliced-halves').children

    expect(halves.every((half) => half.userData.keepShape)).toBe(true)
  })
})
