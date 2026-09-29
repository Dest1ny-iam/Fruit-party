<template>
  <main class="fruit-scene">
    <header class="scene-header">
      <button type="button" class="scene-back" @click="$emit('back')">退出</button>
      <p>3D FRUIT LAB</p>
      <span>{{ status }}</span>
    </header>
    <div class="scene-stage" :class="{ 'is-shaking': isShaking, 'is-flashing': isFlashing }">
      <canvas ref="canvas" class="scene-canvas" @pointerdown="cutCurrentFruit" />
      <span class="scene-impact" aria-hidden="true" />
    </div>
    <p v-if="modelNotice" class="scene-notice">{{ modelNotice }}</p>
    <p v-if="error" class="scene-error">{{ error }}</p>
  </main>
</template>

<script>
import { AmbientLight, Color, DirectionalLight, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FruitAssetManager } from './FruitAssetManager.js'
import { FruitEffects } from './FruitEffects.js'
import { FRUIT_IDS } from './fruit-assets.js'

const JUICE_COLORS = Object.freeze({ watermelon: '#f35f7c', apple: '#f36d55', orange: '#ff9b3d', kiwi: '#9ac85e', mango: '#ffbd4a', lemon: '#f3d54f' })

export default {
  name: 'FruitScene',
  data() {
    return { manager: null, effects: null, renderer: null, scene: null, camera: null, currentFruit: null, currentBomb: null, availableFruits: [], animationFrame: null, previousFrame: 0, nextTargetTimer: null, feedbackTimer: null, status: '加载 3D 水果资源…', error: '', modelNotice: '', isShaking: false, isFlashing: false }
  },
  async mounted() {
    try {
      const canvas = this.$refs.canvas
      this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false })
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      this.scene = new Scene()
      this.scene.background = new Color('#07111f')
      this.camera = new PerspectiveCamera(48, 1, 0.1, 100)
      this.camera.position.set(0, 0, 7)
      this.scene.add(new AmbientLight('#dcecff', 2.4))
      const keyLight = new DirectionalLight('#fff1cf', 3.2)
      keyLight.position.set(3, 5, 4)
      this.scene.add(keyLight)
      this.manager = new FruitAssetManager({ loader: new GLTFLoader() })
      this.effects = new FruitEffects()
      this.availableFruits = await this.manager.preloadAvailable(FRUIT_IDS)
      if (!this.availableFruits.length) throw new Error('没有可用的水果模型')
      if (this.availableFruits.length < FRUIT_IDS.length) {
        this.modelNotice = `已载入 ${this.availableFruits.length} 种写实水果，其余模型资源待补。`
      }
      await this.spawnNextTarget()
      this.status = '点击水果切开'
      this.resize()
      window.addEventListener('resize', this.resize)
      this.animationFrame = requestAnimationFrame(this.renderFrame)
    } catch (caught) {
      this.error = '无法加载可用的 3D 水果模型。请确认 public/models 下至少有一组完整的 whole、halfA、halfB 文件。'
      this.status = '模型未就绪'
      console.error(caught)
    }
  },
  beforeDestroy() {
    cancelAnimationFrame(this.animationFrame)
    window.removeEventListener('resize', this.resize)
    window.clearTimeout(this.nextTargetTimer)
    window.clearTimeout(this.feedbackTimer)
    this.currentFruit?.parent?.remove(this.currentFruit)
    this.currentBomb && this.disposeObject(this.currentBomb)
    this.effects?.dispose()
    this.manager?.dispose(this.scene)
    this.renderer?.dispose()
  },
  methods: {
    async spawnNextTarget() {
      if (!this.scene || !this.effects) return
      if (Math.random() < 0.2) {
        this.currentBomb = this.effects.spawnBomb({ scene: this.scene, position: { x: 0, y: -0.38, z: 0 }, scale: 1.2 })
        this.status = '危险目标'
        return
      }
      const fruit = this.availableFruits[Math.floor(Math.random() * this.availableFruits.length)]
      this.currentFruit = await this.manager.spawnFruit({ fruit, scene: this.scene, position: { x: 0, y: -0.4, z: 0 }, scale: 1.3 })
      this.status = '点击水果切开'
    },
    async cutCurrentFruit() {
      if (!this.manager || !this.effects) return
      if (this.currentBomb) {
        const bomb = this.currentBomb
        this.currentBomb = null
        this.effects.explodeBomb(bomb, { scene: this.scene })
        this.triggerImpact('炸弹爆炸')
        this.queueNextTarget(760)
        return
      }
      if (!this.currentFruit) return
      const whole = this.currentFruit
      this.currentFruit = null
      const fruit = whole.userData.fruit
      await this.manager.cutFruit(whole, { scene: this.scene, direction: { x: 1, y: 0.15, z: 0 } })
      this.effects.spawnFruitSplash({ scene: this.scene, position: whole.position, color: JUICE_COLORS[fruit] })
      this.triggerImpact('果汁飞溅', false)
      this.queueNextTarget(1600)
    },
    queueNextTarget(delay) {
      window.clearTimeout(this.nextTargetTimer)
      this.nextTargetTimer = window.setTimeout(() => this.spawnNextTarget(), delay)
    },
    triggerImpact(status, shake = true) {
      this.status = status
      this.isFlashing = true
      this.isShaking = shake
      window.clearTimeout(this.feedbackTimer)
      this.feedbackTimer = window.setTimeout(() => {
        this.isFlashing = false
        this.isShaking = false
      }, shake ? 360 : 210)
    },
    disposeObject(object) {
      object.parent?.remove(object)
      object.traverse((node) => {
        node.geometry?.dispose?.()
        node.material?.dispose?.()
      })
    },
    resize() {
      if (!this.renderer || !this.camera) return
      const { clientWidth, clientHeight } = this.$refs.canvas
      this.renderer.setSize(clientWidth, clientHeight, false)
      this.camera.aspect = clientWidth / Math.max(clientHeight, 1)
      this.camera.updateProjectionMatrix()
    },
    renderFrame(timestamp) {
      const delta = this.previousFrame ? (timestamp - this.previousFrame) / 1000 : 0
      this.previousFrame = timestamp
      this.manager?.update(delta)
      this.effects?.update(delta)
      if (this.currentFruit) this.currentFruit.rotation.y += delta * 0.9
      if (this.currentBomb) {
        this.currentBomb.rotation.y += delta * 1.75
        const pulse = 1 + Math.sin(timestamp / 90) * 0.045
        this.currentBomb.scale.setScalar(1.2 * pulse)
      }
      this.renderer?.render(this.scene, this.camera)
      this.animationFrame = requestAnimationFrame(this.renderFrame)
    },
  },
}
</script>

<style scoped>
.fruit-scene { min-height: 100vh; padding: 20px; background: #07111f; color: #eff5ff; }
.scene-header { display: grid; grid-template-columns: auto 1fr auto; max-width: 980px; margin: 0 auto 12px; align-items: center; gap: 14px; }
.scene-header p { margin: 0; color: #f0d36d; font-size: 13px; font-weight: 700; letter-spacing: 1px; }
.scene-header span { color: #b4c5dc; font-size: 12px; text-align: right; }
.scene-back { min-height: 34px; padding: 0 13px; border: 1px solid #4a6285; border-radius: 6px; background: #111f33; color: #eaf3ff; }
.scene-stage { position: relative; width: min(980px, 100%); height: min(72vh, 640px); margin: 0 auto; overflow: hidden; border: 1px solid #304766; border-radius: 8px; background: #07111f; }
.scene-stage.is-shaking { animation: scene-shake 340ms ease-out; }
.scene-canvas { display: block; width: 100%; height: 100%; background: #07111f; touch-action: manipulation; }
.scene-impact { position: absolute; inset: 0; pointer-events: none; opacity: 0; background: radial-gradient(circle at center, rgba(255, 208, 126, 0.34), rgba(231, 95, 62, 0.18) 36%, transparent 66%); }
.scene-stage.is-flashing .scene-impact { animation: impact-flash 260ms ease-out; }
.scene-notice { max-width: 980px; margin: 12px auto; color: #b6c7df; font-size: 13px; text-align: center; }
.scene-error { max-width: 980px; margin: 12px auto; padding: 11px 13px; border: 1px solid #8b4b4f; border-radius: 6px; background: #321d25; color: #ffd5d7; font-size: 13px; }
@keyframes scene-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-7px); } 45% { transform: translateX(6px); } 70% { transform: translateX(-3px); } }
@keyframes impact-flash { 0% { opacity: 0; } 34% { opacity: 1; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .scene-stage.is-shaking, .scene-stage.is-flashing .scene-impact { animation: none; } }
</style>
