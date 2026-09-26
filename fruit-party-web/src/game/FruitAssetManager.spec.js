import { Group, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { FruitAssetManager } from './FruitAssetManager.js'

function makeLoader() {
  return { loadAsync: vi.fn(async (url) => ({ scene: Object.assign(new Group(), { name: url }) })) }
}

describe('FruitAssetManager', () => {
  it('preloads each GLB only once and reuses the cache', async () => {
    const loader = makeLoader()
    const manager = new FruitAssetManager({ loader })

    await manager.preload(['apple'])
    await manager.preload(['apple'])

    expect(loader.loadAsync).toHaveBeenCalledTimes(3)
    expect(loader.loadAsync).toHaveBeenCalledWith('/models/苹果/whole.glb')
  })

  it('spawns a complete fruit and replaces it with two physical halves on cut', async () => {
    const loader = makeLoader()
    const scene = new Group()
    const manager = new FruitAssetManager({ loader })
    await manager.preload(['orange'])
    const fruit = await manager.spawnFruit({ fruit: 'orange', scene, position: new Vector3(1, 2, 3) })

    const halves = await manager.cutFruit(fruit, { scene, direction: new Vector3(1, 0, 0) })

    expect(scene.children).not.toContain(fruit)
    expect(halves).toHaveLength(2)
    expect(halves[0].userData.velocity.x).toBeGreaterThan(0)
    expect(halves[1].userData.velocity.x).toBeLessThan(0)
  })

  it('updates a fragment with gravity after cutting', async () => {
    const loader = makeLoader()
    const scene = new Group()
    const manager = new FruitAssetManager({ loader, gravity: -10 })
    await manager.preload(['lemon'])
    const fruit = await manager.spawnFruit({ fruit: 'lemon', scene })
    const [half] = await manager.cutFruit(fruit, { scene })
    const startY = half.position.y

    for (let frame = 0; frame < 60; frame += 1) manager.update(1 / 60)

    expect(half.position.y).toBeLessThan(startY)
  })
})
