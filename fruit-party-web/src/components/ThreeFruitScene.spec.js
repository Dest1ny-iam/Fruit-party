import { describe, expect, it } from 'vitest'
import ThreeFruitScene from './ThreeFruitScene.vue'

describe('ThreeFruitScene', () => {
  it('keeps the fruit apex within the playable board for every difficulty speed', () => {
    const start = ThreeFruitScene.methods.launchStartFor.call({}, 1)
    const gravity = ThreeFruitScene.methods.fruitGravity.call({})
    const normalVelocity = ThreeFruitScene.methods.launchVelocityFor.call({}, 1, 1)
    const hardVelocity = ThreeFruitScene.methods.launchVelocityFor.call({}, 1, 1.5)
    const normalApexY = start[1] + (normalVelocity.y ** 2) / (2 * gravity)
    const hardApexY = start[1] + (hardVelocity.y ** 2) / (2 * gravity)

    expect(normalApexY).toBeGreaterThanOrEqual(0.35)
    expect(normalApexY).toBeLessThanOrEqual(0.55)
    expect(hardApexY).toBe(normalApexY)
  })
})
