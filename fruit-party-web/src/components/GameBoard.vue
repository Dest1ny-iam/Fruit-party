<template>
  <!--
    GameBoard 是第一关的游戏区域。
    游戏区域由 Vue 管理流程，Three.js 负责水果模型、运动和切割碰撞。
  -->
  <main class="game-page">
    <!-- 顶部状态栏：把关卡信息和实时数据集中放在游戏区域上方。 -->
    <header class="game-header">
      <div>
        <p class="game-brand">FRUIT PARTY</p>
        <h1>{{ mode === 'endless' ? '无尽挑战' : `第 ${level.number} 关` }}</h1>
      </div>
      <div class="game-header-actions">
        <div class="game-stats" aria-label="本局游戏状态">
          <p v-if="mode !== 'endless'">目标 <strong>{{ level.targetScore }}</strong></p>
          <p>得分 <strong>{{ score }}</strong></p>
          <p data-test="health">血量 <strong>{{ health }}</strong></p>
          <p data-test="time-left">时间 <strong>{{ gameTimeLabel }}</strong></p>
        </div>
        <button class="exit-game-button" type="button" data-test="exit-game" @click="openExitConfirmation">退出</button>
      </div>
    </header>

    <!--
      外层 section 负责交互和无障碍提示，Three.js canvas 负责真实渲染。
      mousedown / mouseup 用来记录“按住并拖动”的切割状态。
      mouseleave 时也结束切割，避免鼠标离开区域后状态一直卡住。
    -->
    <section
      class="game-board"
      :class="{ 'is-slicing': isSlicing, 'three-unavailable': !threeSupported }"
      data-test="game-board"
      aria-label="第一关游戏区域"
      @mousedown="startSlicing"
      @mouseup="stopSlicing"
      @mouseleave="stopSlicing"
      @pointermove="sliceWithoutClick"
    >
      <!-- Three.js 3D 场景作为背景视觉层，鼠标事件仍由外层区域处理。 -->
      <ThreeFruitScene
        ref="threeScene"
        :fruits="fruits"
        :paused="isExitConfirmationOpen || revivePromptOpen"
        @ready="threeSupported = true"
        @unsupported="threeSupported = false"
        @fruit-sliced="handleFruitSliced"
        @bomb-hit="handleBombHit"
        @fruit-left-board="handleFruitMissed"
      />
      <!--
        v-for 把 fruits 数组中的每个对象渲染成一个水果。
        origin 会转换成 CSS 类名，决定水果从哪一侧飞入。
      -->
      <!-- 水果现在由 Three.js 绘制；这里保留无障碍文本供读屏软件识别。 -->
      <span v-for="fruit in fruits" :key="fruit.id" :class="['fruit-accessibility', `fruit-from-${fruit.origin}`]" data-test="fruit">{{ fruit.emoji }}</span>
      <EndlessItemDock
        v-if="mode === 'endless'"
        :item-ids="activeItems"
        :used-item-ids="usedActiveItems"
        :remaining-by-item="activeItemSeconds"
        @activate="activateEndlessItem"
      />
      <span v-if="cursor.visible" class="blade-cursor" :style="{ left: `${cursor.x}px`, top: `${cursor.y}px` }"></span>
      <p class="board-hint">移动鼠标划过水果即可切开</p>
      <p class="slice-state" aria-live="polite">{{ feedback || (isSlicing ? '刀光掠过' : '等待操作') }}</p>
      <div v-if="isGameOver && !revivePromptOpen" class="game-over" data-test="game-over" role="status">
        <strong>{{ roundResultLabel }}</strong>
        <span>本局得分 {{ score }}</span>
      </div>
      <section v-if="isExitConfirmationOpen" class="exit-confirmation" data-test="exit-confirmation" role="dialog" aria-modal="true" aria-labelledby="exit-confirmation-title" @mousedown.stop @mouseup.stop @pointermove.stop>
        <div class="exit-confirmation-dialog">
          <p class="exit-confirmation-kicker">游戏已暂停</p>
          <h2 id="exit-confirmation-title">确认退出本局？</h2>
          <p>{{ exitConfirmationCopy }}</p>
          <div class="exit-confirmation-actions">
            <button class="continue-game-button" type="button" data-test="cancel-exit" @click="cancelExit">继续游戏</button>
            <button class="confirm-exit-button" type="button" data-test="confirm-exit" @click="confirmExit">确定退出</button>
          </div>
        </div>
      </section>
      <section v-if="revivePromptOpen" class="exit-confirmation" data-test="revive-prompt" role="dialog" aria-modal="true" aria-labelledby="revive-prompt-title" @mousedown.stop @mouseup.stop @pointermove.stop>
        <div class="exit-confirmation-dialog revive-dialog">
          <p class="exit-confirmation-kicker">本局暂停</p>
          <h2 id="revive-prompt-title">要使用复活卡吗？</h2>
          <p>复活后保留当前分数和难度，恢复 50 点血量；本次会消耗 1 张复活卡。</p>
          <p v-if="reviveError" class="revive-error">{{ reviveError }}</p>
          <div class="exit-confirmation-actions">
            <button class="continue-game-button" type="button" data-test="request-revive" :disabled="reviveRequestPending" @click="requestRevive">{{ reviveRequestPending ? '使用中…' : '使用复活卡' }}</button>
            <button class="confirm-exit-button" type="button" data-test="settle-without-revive" :disabled="reviveRequestPending" @click="settleWithoutRevive">结算</button>
          </div>
        </div>
      </section>
    </section>
  </main>
</template>

<script>
import ThreeFruitScene from './ThreeFruitScene.vue'
import EndlessItemDock from './EndlessItemDock.vue'
import { FRUIT_CATALOG, fruitsForWave } from '../game/fruitCatalog'
import { difficultyForWave } from '../game/difficulty'
import { roundSecondsForLevel } from '../game/roundRules'
import { scoreForFruit } from '../game/scoreRules'

export default {
  name: 'GameBoard',
  components: { ThreeFruitScene, EndlessItemDock },
  emits: ['finished', 'revive-requested'],
  props: {
    // 父组件传入当前关卡；组件只读取 number 和 targetScore 来显示 HUD。
    level: {
      type: Object,
      required: true,
    },
    activeItems: { type: Array, default: () => [] },
    mode: { type: String, default: 'normal' },
    // 复活时由 App 带回上一段游戏状态；未传入时就是一局全新的游戏。
    initialRound: { type: Object, default: null },
    reviveCount: { type: Number, default: 0 },
  },
  data() {
    const roundSeconds = this.mode === 'endless' ? Number.POSITIVE_INFINITY : roundSecondsForLevel(this.level.number) + (this.activeItems.includes('time-plus') ? 10 : 0)
    const resumed = this.initialRound || {}
    return {
      // 当前分数和血量暂时是前端本地状态，后续由游戏规则更新。
      score: resumed.score || 0,
      health: resumed.health || 100,
      // true 表示鼠标正在游戏区域内按住；Vue 会根据它自动更新样式和文字。
      isSlicing: false,
      // 当前场上的水果对象；后续碰撞成功或水果落出屏幕时会从这里移除。
      fruits: [],
      // 定时器句柄用于组件销毁时清理，避免离开游戏后仍然生成水果。
      fruitTimer: null,
      // 用固定队列先模拟四面八方，避免测试和演示受到随机数影响。
      directionQueue: ['left', 'bottom', 'right', 'top'],
      nextFruitId: resumed.nextFruitId || 1,
      nextFruitIndex: 0,
      waveCount: resumed.waveCount || 0,
      bombCandidateCount: resumed.bombCandidateCount || 0,
      usedActiveItems: [...(resumed.usedActiveItems || [])],
      activeItemSeconds: {
        'bomb-shield': resumed.activeItemSeconds?.['bomb-shield'] || 0,
        'score-boost': resumed.activeItemSeconds?.['score-boost'] || 0,
      },
      sliceTimer: null,
      feedbackTimer: null,
      feedback: '',
      cursor: { x: 0, y: 0, visible: false },
      // 这些字段是结算页的原始数据来源，不把本局统计分散到多个组件中。
      appearedCount: resumed.appearedCount || 0,
      slicedCount: resumed.slicedCount || 0,
      fruitHits: [...(resumed.fruitHits || [])],
      currentCombo: 0,
      bestCombo: resumed.bestCombo || 0,
      lastSliceAt: 0,
      hasFinished: false,
      // 达标只用于展示提示；普通和困难模式仍要完整玩到倒计时结束。
      targetReached: resumed.score >= this.level.targetScore,
      roundCompleted: null,
      roundSeconds,
      timeLeft: resumed.timeLeft ?? roundSeconds,
      elapsedSeconds: resumed.elapsedSeconds || 0,
      gameTimer: null,
      // WebGL 不可用时切换到 CSS/emoji 降级显示，避免游戏区域空白。
      threeSupported: false,
      isExitConfirmationOpen: false,
      revivePromptOpen: false,
      reviveRequestPending: false,
      reviveError: '',
      reviveUses: resumed.reviveUses || 0,
      pendingEndReason: '',
    }
  },
  computed: {
    roundResultLabel() {
      if (this.mode === 'endless') return '本局结算'
      return this.roundCompleted ? '挑战成功' : '挑战失败'
    },
    exitConfirmationCopy() {
      if (this.mode === 'endless') return '退出后将按当前成绩直接结算，已消耗的能量与携带道具不会返还。'
      return '退出会按当前得分进入失败结算，已消耗的能量与携带道具不会返还。'
    },
    isGameOver() {
      return this.health <= 0 || this.hasFinished
    },
    difficulty() {
      return difficultyForWave(this.waveCount, { level: this.level.number, mode: this.mode })
    },
    gameTimeLabel() {
      if (this.mode !== 'endless') return `${this.timeLeft}s`
      const minutes = Math.floor(this.elapsedSeconds / 60).toString().padStart(2, '0')
      const seconds = (this.elapsedSeconds % 60).toString().padStart(2, '0')
      return `${minutes}:${seconds}`
    },
  },
  mounted() {
    // 先立即生成第一波，避免刚进入游戏时等待一秒才看到水果。
    this.spawnWave()
    // 后续每秒继续生成一波水果；一波三个，制造“同时甩出多个”的效果。
    this.fruitTimer = window.setInterval(this.spawnWave, 1000)
    // 每关按关卡编号计算时限；到时统一根据目标分判定成功或失败。
    this.gameTimer = window.setInterval(this.tickGameClock, 1000)
  },
  beforeUnmount() {
    // 离开游戏页时停止生成，防止定时器持续占用资源。
    window.clearInterval(this.fruitTimer)
    window.clearTimeout(this.sliceTimer)
    window.clearTimeout(this.feedbackTimer)
    window.clearInterval(this.gameTimer)
  },
  methods: {
    // 生成一波水果，并让每个水果使用不同的甩入方向。
    spawnWave() {
      if (this.isExitConfirmationOpen || this.revivePromptOpen || this.isGameOver) return
      const difficulty = difficultyForWave(this.waveCount, { level: this.level.number, mode: this.mode })
      const fruitConfigs = fruitsForWave(this.waveCount, this.level.number, this.mode)
      const fruitsInWave = fruitConfigs.map((config, offset) => {
        // nextFruitId 随每颗水果递增；用它而非固定的“每波 3 个”计算方向，数量变化后仍能均匀来自四面。
        const directionIndex = (this.nextFruitId - 1) % this.directionQueue.length
        const origin = this.directionQueue[directionIndex]
        const fruit = {
          id: this.nextFruitId,
          emoji: config.emoji,
          type: config.type,
          origin,
          speedMultiplier: difficulty.speedMultiplier,
        }
        this.nextFruitId += 1
        return fruit
      })
      const isBombCandidate = this.waveCount > 0 && this.waveCount % difficulty.bombEvery === 0
      const normalBombSuppressed = this.mode !== 'endless' && this.activeItems.includes('bomb-shield') && this.waveCount % 3 === 0
      const endlessBombAllowed = !isBombCandidate || this.mode !== 'endless' || this.shouldSpawnBombCandidate()
      if (isBombCandidate && !normalBombSuppressed && endlessBombAllowed) {
        fruitsInWave.push({ id: this.nextFruitId, emoji: '💣', type: 'bomb', origin: this.directionQueue[(this.waveCount + 1) % 4], speedMultiplier: difficulty.speedMultiplier })
        this.nextFruitId += 1
      }
      this.waveCount += 1
      this.appearedCount += fruitsInWave.filter((fruit) => fruit.type !== 'bomb').length
      // 低关卡只允许六颗同屏水果，避免放大模型后因多波累积而遮挡操作区域。
      const maximumOnBoard = this.mode === 'endless' && this.waveCount >= 20 ? 10 : this.mode === 'hard' || this.level.number > 5 ? 8 : 6
      const nextFruits = [...this.fruits, ...fruitsInWave]
      const overflowCount = Math.max(0, nextFruits.length - maximumOnBoard)
      const overflowFruits = nextFruits.slice(0, overflowCount)
      // 容量淘汰和自然落出都属于漏切；炸弹离场不影响水果连击。
      if (overflowFruits.some((fruit) => fruit.type !== 'bomb')) this.currentCombo = 0
      this.fruits = nextFruits.slice(-maximumOnBoard)
    },
    // mousedown 触发时开始记录切割状态，后续会在这里记录鼠标坐标。
    startSlicing() {
      this.isSlicing = true
    },
    // mouseup 或 mouseleave 触发时结束切割状态。
    stopSlicing() {
      this.isSlicing = false
      this.cursor.visible = false
    },
    // 游戏规则是“滑过即切”，这里不检查鼠标按键，直接把坐标交给 3D 场景做碰撞检测。
    sliceWithoutClick(event) {
      if (this.isExitConfirmationOpen || this.revivePromptOpen || this.isGameOver) return
      const rect = event.currentTarget.getBoundingClientRect()
      this.cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top, visible: true }
      this.isSlicing = true
      this.$refs.threeScene?.sliceAt(event)
      window.clearTimeout(this.sliceTimer)
      this.sliceTimer = window.setTimeout(() => { this.isSlicing = false }, 120)
    },
    handleFruitSliced({ id, type }) {
      if (this.isExitConfirmationOpen || this.revivePromptOpen || this.hasFinished || this.isGameOver) return
      // Three.js 的鼠标事件可能在极短时间内重复抵达；水果已被移除就不允许再次得分。
      if (!this.fruits.some((fruit) => fruit.id === id)) return
      const config = FRUIT_CATALOG[type] || FRUIT_CATALOG.apple
      const now = Date.now()
      this.currentCombo = now - this.lastSliceAt <= 1500 ? this.currentCombo + 1 : 1
      this.lastSliceAt = now
      this.bestCombo = Math.max(this.bestCombo, this.currentCombo)
      const scoreBoostActive = this.mode === 'endless'
        ? this.activeItemSeconds['score-boost'] > 0
        : this.activeItems.includes('score-boost')
      const scoreBoost = scoreBoostActive ? 1.2 : 1
      const gainedScore = scoreForFruit(config.score, this.currentCombo, scoreBoost)
      this.score += gainedScore
      this.slicedCount += 1
      this.fruitHits.push({ fruit: type, combo: this.currentCombo, scoreBoost })
      this.fruits = this.fruits.filter((fruit) => fruit.id !== id)
      const comboMessage = this.currentCombo > 1 ? ` · ${this.currentCombo} 连击` : ''
      this.showFeedback(`+${gainedScore} ${config.name}${comboMessage}`, 700)
      if (this.mode !== 'endless' && !this.targetReached && this.score >= this.level.targetScore) {
        this.targetReached = true
        this.showFeedback('目标已达成 · 继续挑战更高分', 1200)
      }
    },
    // 水果完整落出菜板后由 3D 场景通知；本局只移除并中断连击，漏掉数量会由 appearedCount - slicedCount 进入结算。
    handleFruitMissed({ id }) {
      if (this.isExitConfirmationOpen || this.revivePromptOpen || this.isGameOver || !this.fruits.some((fruit) => fruit.id === id)) return
      this.fruits = this.fruits.filter((fruit) => fruit.id !== id)
      this.currentCombo = 0
      this.showFeedback('水果漏掉', 500)
    },
    handleBombHit({ id }) {
      if (this.isExitConfirmationOpen || this.revivePromptOpen || this.hasFinished || this.isGameOver) return
      this.health = Math.max(0, this.health - 25)
      // 炸弹除了伤害血量，还会压缩当前操作窗口；不足 2 秒时直接归零。
      this.timeLeft = Math.max(0, this.timeLeft - 2)
      this.currentCombo = 0
      this.fruits = this.fruits.filter((fruit) => fruit.id !== id)
      if (this.isGameOver) {
        window.clearInterval(this.fruitTimer)
        this.fruitTimer = null
        this.fruits = []
        window.clearTimeout(this.feedbackTimer)
        this.feedback = '本局结束'
        this.offerReviveOrFinish('bomb')
        return
      }
      if (this.timeLeft <= 0) {
        window.clearInterval(this.fruitTimer)
        this.fruitTimer = null
        this.fruits = []
        window.clearTimeout(this.feedbackTimer)
        this.feedback = '时间耗尽'
        this.offerReviveOrFinish('timeout')
        return
      }
      this.showFeedback('炸弹命中 -25 · 时间 -2s', 900)
    },
    tickGameClock() {
      if (this.isExitConfirmationOpen || this.revivePromptOpen || this.hasFinished) return
      this.tickActiveItems()
      if (this.mode === 'endless') {
        this.elapsedSeconds += 1
        return
      }
      this.timeLeft = Math.max(0, this.timeLeft - 1)
      if (this.timeLeft > 0) return

      window.clearInterval(this.fruitTimer)
      this.fruitTimer = null
      this.fruits = []
      if (this.score >= this.level.targetScore) this.finishGame(true, 'timeout')
      else this.offerReviveOrFinish('timeout')
    },
    canRevive() {
      const limit = this.mode === 'endless' ? 3 : 1
      return Number(this.reviveCount) > this.reviveUses && this.reviveUses < limit
    },
    offerReviveOrFinish(endReason) {
      if (!this.canRevive()) {
        this.finishGame(false, endReason)
        return
      }
      this.pendingEndReason = endReason
      this.revivePromptOpen = true
      this.reviveRequestPending = false
      this.reviveError = ''
    },
    requestRevive() {
      if (this.reviveRequestPending || !this.canRevive()) return
      this.reviveRequestPending = true
      this.reviveError = ''
      this.$emit('revive-requested')
    },
    resumeAfterRevive() {
      this.reviveUses += 1
      this.health = 50
      if (this.mode !== 'endless') this.timeLeft = Math.max(10, this.timeLeft)
      this.currentCombo = 0
      this.revivePromptOpen = false
      this.reviveRequestPending = false
      this.reviveError = ''
      this.pendingEndReason = ''
      if (!this.fruitTimer) this.fruitTimer = window.setInterval(this.spawnWave, 1000)
      this.showFeedback('复活成功 · 挑战继续', 1000)
    },
    rejectRevive(message) {
      this.reviveRequestPending = false
      this.reviveError = message || '复活卡使用失败，请重试'
    },
    settleWithoutRevive() {
      if (this.reviveRequestPending) return
      const endReason = this.pendingEndReason || 'revive-declined'
      this.revivePromptOpen = false
      this.finishGame(false, endReason)
    },
    finishGame(completed, endReason) {
      if (this.hasFinished) return
      this.hasFinished = true
      this.roundCompleted = completed
      window.clearInterval(this.gameTimer)
      this.gameTimer = null
      window.clearInterval(this.fruitTimer)
      this.fruitTimer = null
      this.$emit('finished', {
        mode: this.mode,
        level: this.level.number,
        score: this.score,
        targetScore: this.level.targetScore,
        slicedCount: this.slicedCount,
        appearedCount: this.appearedCount,
        fruitHits: [...this.fruitHits],
        bestCombo: this.bestCombo,
        healthLeft: this.health,
        completed,
        endReason,
        timeLeft: this.timeLeft,
        roundSeconds: this.roundSeconds,
        elapsedSeconds: this.elapsedSeconds,
        roundState: {
          waveCount: this.waveCount,
          nextFruitId: this.nextFruitId,
          bombCandidateCount: this.bombCandidateCount,
          usedActiveItems: [...this.usedActiveItems],
          activeItemSeconds: { ...this.activeItemSeconds },
          reviveUses: this.reviveUses,
        },
      })
    },
    openExitConfirmation() {
      if (!this.isGameOver) this.isExitConfirmationOpen = true
    },
    cancelExit() {
      this.isExitConfirmationOpen = false
    },
    confirmExit() {
      if (!this.isExitConfirmationOpen) return
      this.isExitConfirmationOpen = false
      this.finishGame(false, 'quit')
    },
    activateEndlessItem(itemId) {
      if (this.mode !== 'endless' || !this.activeItems.includes(itemId) || this.usedActiveItems.includes(itemId)) return
      if (!['bomb-shield', 'score-boost'].includes(itemId)) return
      this.usedActiveItems = [...this.usedActiveItems, itemId]
      this.activeItemSeconds = { ...this.activeItemSeconds, [itemId]: 20 }
      this.showFeedback(`${itemId === 'bomb-shield' ? '炸弹削减' : '分数 ×1.2'} · 20s`, 900)
    },
    tickActiveItems() {
      const next = { ...this.activeItemSeconds }
      Object.keys(next).forEach((itemId) => { next[itemId] = Math.max(0, next[itemId] - 1) })
      this.activeItemSeconds = next
    },
    shouldSpawnBombCandidate() {
      this.bombCandidateCount += 1
      if (this.mode !== 'endless' || this.activeItemSeconds['bomb-shield'] <= 0) return true
      return this.bombCandidateCount % 3 === 1
    },
    showFeedback(message, duration) {
      window.clearTimeout(this.feedbackTimer)
      this.feedback = message
      this.feedbackTimer = window.setTimeout(() => { this.feedback = '' }, duration)
    },
  },
}
</script>

<style scoped>
/* 页面延续大厅的黑蓝基调，让游戏区域成为视觉中心。 */
.game-page { min-height: 100vh; padding: 18px 24px; background: #050914; color: #f3f6ff; }
.game-header { display: flex; align-items: end; justify-content: space-between; width: min(1280px, 100%); margin: 0 auto 14px; }
.game-header-actions { display: flex; align-items: center; gap: 14px; }
.game-brand { margin: 0 0 5px; color: #d8b65e; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
h1 { margin: 0; font-size: 25px; }
.game-stats { display: flex; gap: 22px; color: #aebbd0; font-size: 13px; }
.game-stats p { margin: 0; }
.game-stats strong { margin-left: 4px; color: #f8d36f; font-size: 17px; }
.exit-game-button { min-height: 34px; padding: 0 12px; border: 1px solid #405471; border-radius: 4px; background: #101a2a; color: #b8c8dd; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }.exit-game-button:hover { border-color: #718aaa; background: #16243a; color: #edf4ff; }.exit-game-button:focus-visible { outline: 2px solid #f5d66d; outline-offset: 3px; }
.game-board { position: relative; display: grid; min-height: min(740px, calc(100vh - 112px)); place-items: center; width: min(1280px, 100%); margin: 0 auto; overflow: hidden; border: 1px solid #29466d; border-radius: 8px; background: radial-gradient(circle at 50% 35%, #152b4a, #080f1e 70%); box-shadow: inset 0 0 60px #02050d, 0 18px 42px #0008; user-select: none; }
.game-board::before { position: absolute; inset: 0; background: repeating-linear-gradient(135deg, #78a1d20b 0 1px, transparent 1px 90px); content: ''; pointer-events: none; }
.game-fruit { position: absolute; z-index: 1; display: block; font-size: 72px; filter: drop-shadow(0 18px 15px #000b); animation-duration: 2.8s; animation-fill-mode: forwards; animation-timing-function: ease-out; }
.fruit-accessibility { position: absolute; z-index: 3; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.blade-cursor { position: absolute; z-index: 5; width: 12px; height: 12px; border: 2px solid #e9f7ff; border-radius: 50%; box-shadow: 0 0 10px #91dcff, 0 0 24px #79a7ff; pointer-events: none; transform: translate(-50%, -50%); }
.three-unavailable .fruit-accessibility { width: auto; height: auto; overflow: visible; clip: auto; font-size: 72px; filter: drop-shadow(0 18px 15px #000b); animation: fallback-fruit 2.8s ease-out forwards; }
@keyframes fallback-fruit { from { opacity: 0; transform: scale(.7); } 20% { opacity: 1; } to { opacity: 1; transform: translate(20px, -30px) scale(1); } }
.fruit-from-left { top: 43%; left: -90px; animation-name: fly-from-left; }
.fruit-from-bottom { bottom: -90px; left: 43%; animation-name: fly-from-bottom; }
.fruit-from-right { top: 28%; right: -90px; animation-name: fly-from-right; }
.fruit-from-top { top: -90px; left: 63%; animation-name: fly-from-top; }
@keyframes fly-from-left { from { transform: translate(0, 0) rotate(-25deg); } to { transform: translate(75vw, -15vh) rotate(300deg); } }
@keyframes fly-from-bottom { from { transform: translate(0, 0) rotate(0deg); } to { transform: translate(-12vw, -85vh) rotate(340deg); } }
@keyframes fly-from-right { from { transform: translate(0, 0) rotate(20deg); } to { transform: translate(-75vw, 30vh) rotate(-280deg); } }
@keyframes fly-from-top { from { transform: translate(0, 0) rotate(10deg); } to { transform: translate(-25vw, 85vh) rotate(260deg); } }
.board-hint, .slice-state { position: absolute; z-index: 2; margin: 0; color: #aebbd0; font-size: 13px; }
.board-hint { bottom: 26px; }
.slice-state { top: 22px; right: 24px; color: #8fa8ca; }
.game-over { position: absolute; z-index: 6; display: grid; gap: 8px; min-width: 220px; padding: 24px 30px; border: 1px solid #d8b65e; border-radius: 8px; background: #070d19e8; box-shadow: 0 18px 50px #000b, inset 0 0 24px #d8b65e18; text-align: center; backdrop-filter: blur(8px); }
.game-over strong { color: #f8d36f; font-size: 24px; }
.game-over span { color: #c7d2e3; font-size: 13px; }
.exit-confirmation { position: absolute; z-index: 8; inset: 0; display: grid; place-items: center; padding: 20px; background: #040913b8; backdrop-filter: blur(5px); }.exit-confirmation-dialog { width: min(390px, 100%); padding: 24px; border: 1px solid #4a5e7d; border-top: 3px solid #c79543; background: #101a2a; box-shadow: 0 22px 60px #000c; text-align: center; }.exit-confirmation-kicker { margin: 0 0 8px; color: #d4aa5c; font-size: 11px; font-weight: 700; letter-spacing: 1px; }.exit-confirmation h2 { margin: 0; color: #f3f6fc; font-size: 21px; }.exit-confirmation-dialog > p:not(.exit-confirmation-kicker) { margin: 10px 0 20px; color: #aebbd0; font-size: 13px; line-height: 1.6; }.exit-confirmation-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }.exit-confirmation-actions button { min-height: 42px; border-radius: 4px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }.continue-game-button { border: 1px solid #55769a; background: #18304b; color: #e2efff; }.confirm-exit-button { border: 1px solid #754b4b; background: #2a1c24; color: #e9b4ba; }.exit-confirmation-actions button:hover { filter: brightness(1.12); }.exit-confirmation-actions button:focus-visible { outline: 2px solid #f5d66d; outline-offset: 3px; }
.revive-dialog { border-top-color: #d8b65e; }.revive-error { margin: -10px 0 14px !important; color: #ffc4c8 !important; }.exit-confirmation-actions button:disabled { cursor: wait; opacity: .62; }
.game-board.is-slicing { border-color: #d8b65e; box-shadow: inset 0 0 60px #02050d, 0 0 22px #d8b65e55; }
.game-board.is-slicing .slice-state { color: #f8d36f; }
@media (max-width: 700px) { .game-page { padding: 16px; } .game-header { align-items: start; flex-direction: column; gap: 12px; } .game-header-actions { width: 100%; justify-content: space-between; gap: 10px; } .game-stats { flex-wrap: wrap; gap: 9px 14px; } .exit-game-button { flex: 0 0 auto; min-height: 32px; padding: 0 10px; } .exit-confirmation-dialog { padding: 21px 18px; }.exit-confirmation-actions { grid-template-columns: 1fr; }.game-board { min-height: calc(100vh - 170px); } .game-fruit { font-size: 58px; } }
</style>
