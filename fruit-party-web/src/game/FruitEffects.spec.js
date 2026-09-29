import { Group, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { FruitEffects } from './FruitEffects.js'

describe('FruitEffects', () => {
  it('adds bounded fruit juice particles and removes them after their lifetime', () => {
    const scene = new Group()
    const effects = new FruitEffects({ maxParticles: 12, gravity: -10 })

    const droplets = effects.spawnFruitSplash({ scene, position: new Vector3(0, 1, 0), color: '#ff9d3c', count: 8 })

    expect(droplets).toHaveLength(8)
    expect(scene.children).toHaveLength(8)
    expect(droplets.every((droplet) => droplet.userData.effectType === 'juice')).toBe(true)

    effects.update(2)

    expect(scene.children).toHaveLength(0)
    expect(effects.activeCount).toBe(0)
  })

  it('replaces a bomb with an explosion burst instead of fruit slices', () => {
    const scene = new Group()
    const effects = new FruitEffects({ maxParticles: 32 })
    const bomb = effects.spawnBomb({ scene, position: new Vector3(0, 0, 0) })

    const fragments = effects.explodeBomb(bomb, { scene, count: 18 })

    expect(scene.children).not.toContain(bomb)
    expect(fragments).toHaveLength(18)
    expect(fragments.every((fragment) => fragment.userData.effectType === 'explosion')).toBe(true)
  })
})
