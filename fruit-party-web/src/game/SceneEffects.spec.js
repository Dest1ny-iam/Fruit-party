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
    for (const type of ['apple', 'watermelon', 'kiwi', 'banana', 'dragonfruit']) {
      const whole = createFruitModel(type)
      const effect = createJuiceEffect(new THREE.Vector3(), type)
      const halves = effect.getObjectByName('sliced-halves').children
      const wholeSize = largestDimension(whole)

      halves.forEach((half) => {
        expect(largestDimension(half), `${type} cut half`).toBeGreaterThanOrEqual(wholeSize * 0.9)
      })
    }
  })
})
