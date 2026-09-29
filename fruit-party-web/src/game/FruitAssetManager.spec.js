import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { FruitAssetManager } from './FruitAssetManager.js'
import { FRUIT_ASSETS, FRUIT_IDS, listFruitModelPaths } from './fruit-assets.js'

function makeLoader() {
  return { loadAsync: vi.fn(async (url) => ({ scene: Object.assign(new Group(), { name: url }) })) }
}

function makeCuttableLoader() {
  return {
    loadAsync: vi.fn(async (url) => {
      const scene = new Group()
      const outer = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ color: '#7b3f16' }))
      outer.name = 'food_kiwi_01'
      scene.add(outer)
      if (!url.includes('/whole.glb')) {
        const flesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ color: '#ffffff' }))
        flesh.name = 'Fruit_flesh'
        const rind = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ color: '#ffffff' }))
        rind.name = 'Fruit_rind'
        scene.add(flesh, rind)
      }
      return { scene }
    }),
  }
}

describe('FruitAssetManager', () => {
  it('defines the six fruits and all eighteen runtime GLB paths in one manifest', () => {
    expect(FRUIT_IDS).toEqual(['watermelon', 'apple', 'orange', 'kiwi', 'mango', 'lemon'])
    expect(FRUIT_ASSETS.orange.directory).toBe('橙子')
    expect(listFruitModelPaths()).toEqual(expect.arrayContaining([
      '/models/西瓜/whole.glb',
      '/models/苹果/halfA.glb',
      '/models/柠檬/halfB.glb',
    ]))
    expect(listFruitModelPaths()).toHaveLength(18)
  })

  it('preloads each GLB only once and reuses the cache', async () => {
    const loader = makeLoader()
    const manager = new FruitAssetManager({ loader })

    await manager.preload(['apple'])
    await manager.preload(['apple'])

    expect(loader.loadAsync).toHaveBeenCalledTimes(3)
    expect(loader.loadAsync).toHaveBeenCalledWith('/models/苹果/whole.glb')
  })

  it('returns only fruits whose three model variants all preload successfully', async () => {
    const loader = {
      loadAsync: vi.fn(async (url) => {
        if (url.includes('/橙子/')) throw new Error('asset missing')
        return { scene: new Group() }
      }),
    }
    const manager = new FruitAssetManager({ loader })

    await expect(manager.preloadAvailable(['apple', 'orange'])).resolves.toEqual(['apple'])
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

  it('keeps both cut faces nearly perpendicular to the camera instead of turning them edge-on', async () => {
    const loader = makeLoader()
    const scene = new Group()
    const manager = new FruitAssetManager({ loader })
    await manager.preload(['kiwi'])
    const fruit = await manager.spawnFruit({ fruit: 'kiwi', scene })

    const [frontHalf, backHalf] = await manager.cutFruit(fruit, { scene, direction: new Vector3(1, 0, 0) })

    expect(Math.abs(new Vector3(0, 0, 1).applyQuaternion(frontHalf.quaternion).z)).toBeGreaterThan(0.9)
    expect(Math.abs(new Vector3(0, 0, 1).applyQuaternion(backHalf.quaternion).z)).toBeGreaterThan(0.9)
  })

  it('keeps the scanned outer texture while assigning distinct flesh and rind materials', async () => {
    const scene = new Group()
    const manager = new FruitAssetManager({ loader: makeCuttableLoader() })
    await manager.preload(['kiwi'])
    const whole = await manager.spawnFruit({ fruit: 'kiwi', scene })

    const [half] = await manager.cutFruit(whole, { scene })

    expect(half.getObjectByName('food_kiwi_01').material.color.getHexString()).toBe('7b3f16')
    expect(half.getObjectByName('Fruit_flesh').material.color.getHexString()).toBe('6fa645')
    expect(half.getObjectByName('Fruit_flesh').material.side).toBe(2)
    expect(half.getObjectByName('Fruit_rind').material.color.getHexString()).toBe('5f321a')
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
