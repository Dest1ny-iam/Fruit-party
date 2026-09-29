import { describe, expect, it } from 'vitest'
import FruitSceneSource from './FruitScene.vue?raw'

describe('FruitScene model loading', () => {
  it('uses successfully loaded fruit assets instead of falling back to geometric spheres', () => {
    expect(FruitSceneSource).toContain('this.manager.preloadAvailable(FRUIT_IDS)')
    expect(FruitSceneSource).toContain('this.availableFruits[Math.floor(Math.random() * this.availableFruits.length)]')
    expect(FruitSceneSource).not.toContain('this.createFallbackFruit(fruit)')
  })
})
