<template>
  <!-- Three.js 将真实光照、阴影和水果模型绘制进这个画布。 -->
  <div ref="sceneContainer" class="three-scene" data-test="three-scene" aria-label="3D 水果展示区域">
    <canvas ref="canvas" class="three-canvas"></canvas>
  </div>
</template>

<script>
import * as THREE from 'three'
import { markRaw } from 'vue'
import { createBombModel, createFruitModel } from '../game/FruitModelFactory'
import { createExplosionEffect, createJuiceEffect, updateEffect } from '../game/SceneEffects'

export default {
  name: 'ThreeFruitScene',
  props: { fruits: { type: Array, default: () => [] }, paused: { type: Boolean, default: false } },
  emits: ['ready', 'unsupported', 'fruit-sliced', 'bomb-hit', 'fruit-left-board'],
  data() {
    return {
      scene: null,
      camera: null,
      renderer: null,
      animationFrame: null,
      fruitMeshes: markRaw(Object.create(null)),
      clock: markRaw(new THREE.Clock()),
      raycaster: markRaw(new THREE.Raycaster()),
      pointer: markRaw(new THREE.Vector2()),
      effects: markRaw([]),
      shakeUntil: 0,
    }
  },
  mounted() {
    this.initScene()
    window.addEventListener('resize', this.resizeScene)
  },
  watch: { fruits: { deep: true, handler(value) { this.syncFruits(value) } } },
  beforeUnmount() {
    window.removeEventListener('resize', this.resizeScene)
    if (this.animationFrame) window.cancelAnimationFrame(this.animationFrame)
    Object.values(this.fruitMeshes).forEach(({ mesh }) => this.disposeObject(mesh))
    this.effects.forEach((effect) => this.disposeObject(effect))
    if (this.scene) this.disposeObject(this.scene.getObjectByName('cutting-board'))
    if (this.renderer) this.renderer.dispose()
  },
  methods: {
    initScene() {
      try {
        this.scene = markRaw(new THREE.Scene())
        this.scene.fog = new THREE.FogExp2(0x07101d, 0.035)
        this.camera = markRaw(new THREE.PerspectiveCamera(38, 1, 0.1, 100))
        // 略微拉近相机，配合更大的模型让菜板区域更饱满，但保留完整的圆形边缘。
        this.camera.position.set(0, 0.15, 8.35)
        this.renderer = markRaw(new THREE.WebGLRenderer({ canvas: this.$refs.canvas, antialias: true, alpha: true }))
        this.configureRenderer(this.renderer)
        this.resizeScene()
        this.setupLights()
        this.scene.add(this.createCuttingBoard())
        this.syncFruits(this.fruits)
        this.animate()
        this.$emit('ready')
      } catch (error) {
        this.$emit('unsupported', error)
      }
    },
    configureRenderer(renderer) {
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.VSMShadowMap
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.18
      if (renderer.setClearColor) renderer.setClearColor(0x000000, 0)
      if (renderer.setPixelRatio) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    },
    setupLights() {
      this.scene.add(new THREE.HemisphereLight(0xc9e4ff, 0x152014, 2.05))
      this.scene.add(new THREE.AmbientLight(0x9bbdff, 0.9))
      const key = new THREE.DirectionalLight(0xffe8c2, 3.2)
      key.position.set(-3.4, 5.2, 6.4)
      key.castShadow = true
      key.shadow.mapSize.set(2048, 2048)
      key.shadow.camera.left = -5
      key.shadow.camera.right = 5
      key.shadow.camera.top = 4
      key.shadow.camera.bottom = -4
      key.shadow.bias = -0.0004
      key.shadow.radius = 8
      key.shadow.normalBias = 0.055
      this.scene.add(key)
      const rim = new THREE.DirectionalLight(0x5d8fff, 2.2)
      rim.position.set(4.5, 1.6, 2)
      this.scene.add(rim)
      // 填充光只抬高阴影区域的底色，不参与投影，避免菜板上出现整块黑斑。
      const fill = new THREE.DirectionalLight(0x8fb8ff, 1.35)
      fill.position.set(1.5, -2.5, 4)
      this.scene.add(fill)
      const boardGlow = new THREE.PointLight(0xff9e55, 1.3, 9)
      boardGlow.position.set(0, -2.7, 2.2)
      this.scene.add(boardGlow)
    },
    createCuttingBoard() {
      const board = new THREE.Group()
      board.name = 'cutting-board'
      const wood = new THREE.MeshStandardMaterial({ color: 0x84522f, roughness: 0.83, metalness: 0.02 })
      const surface = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.12, 0.22, 72), wood)
      surface.name = 'board-surface'
      surface.rotation.x = Math.PI / 2
      surface.position.z = -1.16
      surface.receiveShadow = true
      board.add(surface)
      const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xc18147, roughness: 0.68 })
      const rim = new THREE.Mesh(new THREE.TorusGeometry(3.04, 0.055, 10, 96), rimMaterial)
      rim.name = 'board-rim'
      rim.position.z = -1.02
      rim.receiveShadow = true
      board.add(rim)
      const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x5c351f, transparent: true, opacity: 0.28 })
      ;[0.88, 1.62, 2.34].forEach((radius) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.012, 5, 72), ringMaterial)
        ring.position.z = -1.015
        board.add(ring)
      })
      return markRaw(board)
    },
    animate() {
      if (!this.renderer) return
      const delta = this.paused ? 0 : Math.min(this.clock.getDelta(), 0.05)
      const elapsed = this.clock.elapsedTime
      Object.values(this.fruitMeshes).forEach((item) => {
        // 速度以“每秒世界坐标”保存，按 delta 推进才不会随显示器刷新率改变飞行距离。
        item.mesh.rotation.x += item.spin * 0.65 * delta * 60
        item.mesh.rotation.y += item.spin * delta * 60
        item.mesh.position.addScaledVector(item.velocity, delta)
        // 重力持续降低竖直速度：水果先上升、减速、到顶，再自然落下。
        item.velocity.y -= this.fruitGravity() * delta
        const ember = item.mesh.getObjectByName('bomb-ember')
        if (ember) ember.scale.setScalar(0.8 + Math.sin(elapsed * 18) * 0.25)
        if (this.hasLeftBoard(item.mesh.position)) {
          const payload = { id: item.fruit.id, type: item.fruit.type }
          this.removeObject(item.fruit.id)
          this.$emit('fruit-left-board', payload)
        }
      })
      for (let index = this.effects.length - 1; index >= 0; index -= 1) {
        const effect = this.effects[index]
        if (!updateEffect(effect, elapsed, delta)) {
          this.scene.remove(effect)
          this.disposeObject(effect)
          this.effects.splice(index, 1)
        }
      }
      if (elapsed < this.shakeUntil) {
        this.camera.position.x = Math.sin(elapsed * 72) * 0.055
        this.camera.position.y = 0.15 + Math.cos(elapsed * 61) * 0.045
      } else {
        this.camera.position.set(0, 0.15, 8.35)
      }
      this.renderer.render(this.scene, this.camera)
      this.animationFrame = window.requestAnimationFrame(this.animate)
    },
    syncFruits(fruits) {
      if (!this.scene) return
      const activeIds = new Set(fruits.map((fruit) => String(fruit.id)))
      Object.keys(this.fruitMeshes).forEach((id) => {
        if (!activeIds.has(id)) this.removeObject(Number(id))
      })
      fruits.forEach((fruit) => {
        if (this.fruitMeshes[fruit.id]) return
        const model = fruit.type === 'bomb' ? createBombModel() : createFruitModel(fruit.type)
        // 所有水果都从菜板下方发射，横向位置由 id 稳定分散，避免同一轨迹重叠。
        const start = this.launchStartFor(fruit.id)
        model.position.set(...start)
        model.rotation.set(fruit.id * 0.17, fruit.id * 0.31, fruit.id * 0.11)
        model.userData.gameId = fruit.id
        model.traverse((child) => { child.userData.rootId = fruit.id })
        this.scene.add(model)
        this.fruitMeshes[fruit.id] = markRaw({
          mesh: model, spin: this.spinFor(fruit.id), velocity: this.launchVelocityFor(fruit.id, fruit.speedMultiplier),
          phase: fruit.id * 0.8, fruit,
        })
      })
    },
    sliceAt(event) {
      if (this.paused || !this.camera || !this.scene || !this.$refs.sceneContainer) return
      const rect = this.$refs.sceneContainer.getBoundingClientRect()
      this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      this.raycaster.setFromCamera(this.pointer, this.camera)
      const targets = Object.values(this.fruitMeshes).map((item) => item.mesh)
      const hit = this.raycaster.intersectObjects(targets, true)[0]
      if (!hit) return
      const id = hit.object.userData.rootId
      const item = this.fruitMeshes[id]
      if (!item || item.isSliced) return
      // 先锁定该对象，再创建特效与发事件，连续 pointermove 无法将同一水果切多次。
      item.isSliced = true
      const payload = { id, type: item.fruit.type, position: item.mesh.position.clone() }
      const now = this.clock.elapsedTime
      const effect = item.fruit.type === 'bomb'
        ? createExplosionEffect(payload.position, now)
        : createJuiceEffect(payload.position, item.fruit.type, now)
      this.scene.add(effect)
      this.effects.push(markRaw(effect))
      if (item.fruit.type === 'bomb') this.shakeUntil = now + 0.58
      this.removeObject(id)
      this.$emit(item.fruit.type === 'bomb' ? 'bomb-hit' : 'fruit-sliced', payload)
    },
    removeObject(id) {
      const item = this.fruitMeshes[id]
      if (!item) return
      this.scene.remove(item.mesh)
      this.disposeObject(item.mesh)
      delete this.fruitMeshes[id]
    },
    velocityFor(origin, speedMultiplier = 1) {
      const velocities = {
        left: new THREE.Vector3(0.029, 0.006, 0), right: new THREE.Vector3(-0.029, -0.005, 0),
        top: new THREE.Vector3(-0.005, -0.029, 0), bottom: new THREE.Vector3(0.006, 0.029, 0),
      }
      return markRaw((velocities[origin] || new THREE.Vector3()).multiplyScalar(speedMultiplier))
    },
    launchStartFor(id) {
      const lane = (id % 5) - 2
      return [lane * 0.78, -3.42, (id % 3 - 1) * 0.08]
    },
    launchVelocityFor(id, speedMultiplier = 1) {
      const lane = (id % 5) - 2
      // 难度只加快横向掠过速度；竖直初速度固定，避免高难关把水果抛出可操作区域。
      return markRaw(new THREE.Vector3(lane * 0.45 * speedMultiplier, 6.65, (id % 2 ? 0.12 : -0.12) * speedMultiplier))
    },
    fruitGravity() {
      return 5.8
    },
    hasLeftBoard(position) {
      // 只在落到菜板下方或越过两侧很远时移除，上升阶段不会提前消失。
      return position.y < -4.3 || Math.abs(position.x) > 4.8
    },
    spinFor(id) {
      return 0.0028 + (id % 3) * 0.0002
    },
    disposeObject(object) {
      if (!object) return
      object.traverse((child) => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          materials.forEach((material) => material.dispose())
        }
      })
    },
    resizeScene() {
      if (!this.camera || !this.renderer || !this.$refs.sceneContainer) return
      const width = this.$refs.sceneContainer.clientWidth || 960
      const height = this.$refs.sceneContainer.clientHeight || 620
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(width, height, false)
    },
  },
}
</script>

<style scoped>
.three-scene { position: absolute; z-index: 1; inset: 0; pointer-events: none; }
.three-canvas { display: block; width: 100%; height: 100%; }
</style>
