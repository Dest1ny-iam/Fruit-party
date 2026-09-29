import { Color, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three'

function asVector3(value) {
  return value?.isVector3 ? value.clone() : new Vector3(value?.x || 0, value?.y || 0, value?.z || 0)
}

export class FruitEffects {
  constructor({ maxParticles = 72, gravity = -16 } = {}) {
    this.maxParticles = maxParticles
    this.gravity = gravity
    this.active = new Set()
    this.dropletGeometry = new SphereGeometry(0.055, 8, 6)
    this.sparkGeometry = new IcosahedronGeometry(0.07, 0)
  }

  get activeCount() {
    return this.active.size
  }

  spawnFruitSplash({ scene, position, color = '#ffbf5c', count = 16 }) {
    return this.spawnParticles({ scene, position, color, count, effectType: 'juice', speed: 3.8, lifetime: 0.68 })
  }

  spawnBomb({ scene, position, scale = 1 }) {
    if (!scene?.add) throw new Error('spawnBomb requires a Three.js scene or group')
    const bomb = new Group()
    const body = new Mesh(new IcosahedronGeometry(0.62, 2), new MeshBasicMaterial({ color: '#151d2c' }))
    const ember = new Mesh(new SphereGeometry(0.15, 12, 8), new MeshBasicMaterial({ color: '#ef8750' }))
    ember.position.set(0.15, 0.43, 0.38)
    bomb.add(body, ember)
    bomb.position.copy(asVector3(position))
    bomb.scale.setScalar(scale)
    bomb.userData = { kind: 'bomb' }
    scene.add(bomb)
    return bomb
  }

  explodeBomb(bomb, { scene = bomb?.parent, count = 28 } = {}) {
    if (!bomb?.userData?.kind || !scene?.add) throw new Error('explodeBomb requires a bomb created by spawnBomb')
    const fragments = this.spawnParticles({
      scene,
      position: bomb.position,
      color: '#ff8757',
      count,
      effectType: 'explosion',
      speed: 6.8,
      lifetime: 0.86,
    })
    bomb.parent?.remove(bomb)
    bomb.traverse((node) => {
      node.geometry?.dispose?.()
      node.material?.dispose?.()
    })
    return fragments
  }

  spawnParticles({ scene, position, color, count, effectType, speed, lifetime }) {
    if (!scene?.add) throw new Error('Fruit effect requires a Three.js scene or group')
    const origin = asVector3(position)
    const particles = []
    const allowed = Math.max(0, Math.min(count, this.maxParticles))
    this.trimToCapacity(allowed)

    for (let index = 0; index < allowed; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const horizontalSpeed = speed * (0.35 + Math.random() * 0.75)
      const particle = new Mesh(
        effectType === 'juice' ? this.dropletGeometry : this.sparkGeometry,
        new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.92 }),
      )
      particle.position.copy(origin)
      particle.scale.setScalar(0.65 + Math.random() * 0.9)
      particle.userData = {
        effectType,
        velocity: new Vector3(Math.cos(angle) * horizontalSpeed, speed * (0.45 + Math.random() * 0.72), Math.sin(angle) * horizontalSpeed * 0.35),
        age: 0,
        lifetime: lifetime * (0.72 + Math.random() * 0.35),
      }
      scene.add(particle)
      this.active.add(particle)
      particles.push(particle)
    }
    return particles
  }

  trimToCapacity(incomingCount) {
    const overflow = Math.max(0, this.active.size + incomingCount - this.maxParticles)
    for (const particle of [...this.active].slice(0, overflow)) this.removeParticle(particle)
  }

  update(deltaSeconds) {
    const delta = Math.min(Math.max(Number(deltaSeconds) || 0, 0), 1)
    for (const particle of [...this.active]) {
      const { velocity } = particle.userData
      particle.userData.age += delta
      velocity.y += this.gravity * delta
      particle.position.addScaledVector(velocity, delta)
      particle.rotation.x += velocity.y * delta * 0.35
      particle.rotation.z += velocity.x * delta * 0.25
      particle.material.opacity = Math.max(0, 1 - (particle.userData.age / particle.userData.lifetime))
      if (particle.userData.age >= particle.userData.lifetime || particle.position.y < -10) this.removeParticle(particle)
    }
  }

  removeParticle(particle) {
    particle.parent?.remove(particle)
    particle.material?.dispose?.()
    this.active.delete(particle)
  }

  dispose() {
    for (const particle of [...this.active]) this.removeParticle(particle)
    this.dropletGeometry.dispose()
    this.sparkGeometry.dispose()
  }
}
