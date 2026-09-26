import { Vector3 } from 'three'

export const FRUIT_MODEL_NAMES = Object.freeze({
  watermelon: '西瓜',
  apple: '苹果',
  orange: '橙子',
  kiwi: '猕猴桃',
  mango: '芒果',
  lemon: '柠檬',
})

const VARIANTS = ['whole', 'halfA', 'halfB']

function asVector3(value) {
  return value?.isVector3 ? value.clone() : new Vector3(value?.x || 0, value?.y || 0, value?.z || 0)
}

export class FruitAssetManager {
  constructor({ loader, assetBaseUrl = '/models', gravity = -18 } = {}) {
    if (!loader?.loadAsync) throw new Error('FruitAssetManager requires a GLTFLoader-like loader')
    this.loader = loader
    this.assetBaseUrl = assetBaseUrl.replace(/\/$/, '')
    this.gravity = gravity
    this.assets = new Map()
    this.fragments = new Set()
  }

  modelUrl(fruit, variant) {
    const directory = FRUIT_MODEL_NAMES[fruit]
    if (!directory || !VARIANTS.includes(variant)) throw new Error(`Unknown fruit asset: ${fruit}/${variant}`)
    return `${this.assetBaseUrl}/${directory}/${variant}.glb`
  }

  async preload(fruits = Object.keys(FRUIT_MODEL_NAMES)) {
    await Promise.all(fruits.flatMap((fruit) => VARIANTS.map((variant) => this.load(fruit, variant))))
  }

  async load(fruit, variant) {
    const key = `${fruit}:${variant}`
    if (!this.assets.has(key)) {
      this.assets.set(key, this.loader.loadAsync(this.modelUrl(fruit, variant)).then((gltf) => gltf.scene))
    }
    return this.assets.get(key)
  }

  async spawnFruit({ fruit, scene, position, velocity, scale = 1 }) {
    if (!scene?.add) throw new Error('spawnFruit requires a Three.js scene or group')
    const template = await this.load(fruit, 'whole')
    const whole = template.clone(true)
    whole.position.copy(asVector3(position))
    whole.scale.setScalar(scale)
    whole.userData = {
      ...whole.userData,
      fruit,
      wholeFruit: true,
      velocity: asVector3(velocity),
    }
    scene.add(whole)
    return whole
  }

  async cutFruit(whole, { scene = whole?.parent, direction, impulse = 7 } = {}) {
    if (!whole?.userData?.wholeFruit) throw new Error('cutFruit requires a fruit created by spawnFruit')
    if (!scene?.add) throw new Error('cutFruit requires the fruit scene')
    const [templateA, templateB] = await Promise.all([this.load(whole.userData.fruit, 'halfA'), this.load(whole.userData.fruit, 'halfB')])
    const splitDirection = asVector3(direction)
    if (splitDirection.lengthSq() === 0) splitDirection.set(1, 0, 0)
    splitDirection.normalize()
    const inheritedVelocity = asVector3(whole.userData.velocity)
    const halves = [templateA, templateB].map((template, index) => {
      const half = template.clone(true)
      const side = index === 0 ? 1 : -1
      half.position.copy(whole.position).addScaledVector(splitDirection, side * 0.12)
      half.quaternion.copy(whole.quaternion)
      half.scale.copy(whole.scale)
      half.userData = {
        ...half.userData,
        fruit: whole.userData.fruit,
        fragment: true,
        velocity: inheritedVelocity.clone().addScaledVector(splitDirection, side * impulse).add(new Vector3(0, 2, 0)),
        angularVelocity: new Vector3(0.8 * side, 1.5 * side, 0.4 * side),
      }
      scene.add(half)
      this.fragments.add(half)
      return half
    })
    whole.parent?.remove(whole)
    return halves
  }

  update(deltaSeconds) {
    const delta = Math.min(Math.max(Number(deltaSeconds) || 0, 0), 0.05)
    for (const fragment of [...this.fragments]) {
      const { velocity, angularVelocity } = fragment.userData
      velocity.y += this.gravity * delta
      fragment.position.addScaledVector(velocity, delta)
      fragment.rotation.x += angularVelocity.x * delta
      fragment.rotation.y += angularVelocity.y * delta
      fragment.rotation.z += angularVelocity.z * delta
      if (fragment.position.y < -12) {
        fragment.parent?.remove(fragment)
        this.fragments.delete(fragment)
      }
    }
  }

  dispose(scene) {
    for (const fragment of this.fragments) scene?.remove(fragment)
    this.fragments.clear()
    this.assets.clear()
  }
}
