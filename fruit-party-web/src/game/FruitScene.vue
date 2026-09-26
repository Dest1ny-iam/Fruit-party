<template>
  <main class="fruit-scene">
    <header class="scene-header">
      <button type="button" class="scene-back" @click="$emit('back')">退出</button>
      <p>3D FRUIT LAB</p>
      <span>{{ status }}</span>
    </header>
    <canvas ref="canvas" class="scene-canvas" @pointerdown="cutCurrentFruit" />
    <p v-if="error" class="scene-error">{{ error }}</p>
  </main>
</template>

<script>
import { AmbientLight, Color, DirectionalLight, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FruitAssetManager } from './FruitAssetManager.js'

export default {
  name: 'FruitScene',
  data() {
    return { manager: null, renderer: null, scene: null, camera: null, currentFruit: null, animationFrame: null, previousFrame: 0, status: '加载 3D 水果资源…', error: '' }
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
      await this.manager.preload(['watermelon', 'apple', 'orange', 'kiwi', 'mango', 'lemon'])
      await this.spawnNextFruit()
      this.status = '点击水果切开'
      this.resize()
      window.addEventListener('resize', this.resize)
      this.animationFrame = requestAnimationFrame(this.renderFrame)
    } catch (caught) {
      this.error = '无法加载 3D 水果模型。请确认 public/models 下的水果目录和 three 个 GLB 文件已放置完成。'
      this.status = '模型未就绪'
      console.error(caught)
    }
  },
  beforeDestroy() {
    cancelAnimationFrame(this.animationFrame)
    window.removeEventListener('resize', this.resize)
    this.manager?.dispose(this.scene)
    this.renderer?.dispose()
  },
  methods: {
    async spawnNextFruit() {
      const fruits = ['watermelon', 'apple', 'orange', 'kiwi', 'mango', 'lemon']
      const fruit = fruits[Math.floor(Math.random() * fruits.length)]
      this.currentFruit = await this.manager.spawnFruit({ fruit, scene: this.scene, position: { x: 0, y: -0.4, z: 0 }, scale: 1.3 })
    },
    async cutCurrentFruit() {
      if (!this.currentFruit || !this.manager) return
      const whole = this.currentFruit
      this.currentFruit = null
      await this.manager.cutFruit(whole, { scene: this.scene, direction: { x: 1, y: 0.15, z: 0 } })
      window.setTimeout(() => this.spawnNextFruit(), 520)
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
.scene-canvas { display: block; width: min(980px, 100%); height: min(72vh, 640px); margin: 0 auto; border: 1px solid #304766; border-radius: 8px; background: #07111f; touch-action: manipulation; }
.scene-error { max-width: 980px; margin: 12px auto; padding: 11px 13px; border: 1px solid #8b4b4f; border-radius: 6px; background: #321d25; color: #ffd5d7; font-size: 13px; }
</style>
