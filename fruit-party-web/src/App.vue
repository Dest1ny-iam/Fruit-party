<template>
  <div class="app-shell">
  <!--
    App.vue 是整个前端的根组件。
    它不负责绘制所有细节，只根据 screen 决定当前应该显示哪个页面。
  -->
  <!--
    v-if：当 screen 等于 auth 时显示登录注册组件。
    @enter：AuthPanel 登录成功后发出 enter 事件，调用 enterHub 方法。
  -->
  <keep-alive v-if="screen === 'auth'">
    <AuthPanel
      :error-message="authError"
      :submitting="authSubmitting"
      :account-disabled="accountDisabledNotice"
      @authenticate="enterHub"
      @validation-error="authError = $event"
      @open-legal="openLegalDocument"
      @close-account-disabled="accountDisabledNotice = false"
    />
  </keep-alive>
  <LegalDocument v-else-if="screen === 'legal'" :document-type="legalDocumentType" @back="screen = 'auth'" />
  <AdminConsole
    v-else-if="screen === 'admin'"
    :api="api"
    :section="adminSection"
    :maintenance-enabled="maintenanceEnabled"
    @navigate="adminSection = $event"
    @maintenance-change="toggleMaintenance"
    @logout="logout"
  />
  <!--
    v-else-if：只有前面的 v-if 不成立时才会判断这里。
    :highest-level：把普通模式最高关卡传给大厅，控制无尽模式是否解锁。
    @select-mode：大厅选择模式后把事件交回 App 统一处理页面跳转。
  -->
  <GameHub
    v-else-if="screen === 'hub'"
    :player="playerState.player"
    :wallet="playerState.wallet"
    :energy-remaining-seconds="energyRemainingSeconds"
    :leaderboards="leaderboards"
    :highest-level="highestLevel"
    @select-mode="selectMode"
    @open-panel="openPlayerPanel"
    @toggle-testing-mode="setTestingMode"
  />
  <ProfilePage
    v-else-if="screen === 'profile'"
    :username="playerState.player?.username || ''"
    :avatar="playerState.player?.avatarUrl || '🍉'"
    :coins="playerState.wallet?.coins || 0"
    :energy="playerState.wallet?.energy || 0"
    :highest-level="playerState.progress.normal.highestUnlockedLevel"
    :highest-hard-level="playerState.progress.hard.highestUnlockedLevel"
    :coin-ledger="walletLedger.items"
    @back="screen = 'hub'"
    @avatar-change="updateProfile({ avatarUrl: $event })"
    @username-change="updateProfile({ username: $event })"
    @logout="logout"
  />
  <!--
    v-else：当前 screen 既不是 auth 也不是 hub 时显示关卡页。
    :highest-level：告诉关卡页哪些关卡可以点击。
    @back="screen = 'hub'"：点击返回大厅时直接修改 screen。
  -->
  <LevelSelector v-else-if="screen === 'levels'" :levels="playerState.progress[currentMode].levels" :mode="currentMode" :allow-all-levels="Boolean(playerState.privileges?.unlockAllLevels)" @back="screen = 'hub'" @start="startLevel" />
  <GameBoard v-else-if="screen === 'game'" ref="gameBoard" :level="currentLevel" :mode="currentMode" :session-id="currentGameEntry?.sessionId || ''" :active-items="currentGameEntry?.activeItems || []" :revive-count="reviveCount" :maintenance-enabled="maintenanceEnabled" @finished="finishGame" @revive-requested="useReviveCard" @item-activation-requested="activateGameItem" />
  <SettlementPanel
    v-else-if="screen === 'settlement'"
    :mode="currentSettlement.mode"
    :level-number="currentSettlement.levelNumber"
    :final-score="currentSettlement.finalScore"
    :base-score="currentSettlement.baseScore"
    :performance-score="currentSettlement.performanceScore"
    :target-score="currentSettlement.targetScore"
    :hit-rate="currentSettlement.hitRate"
    :elapsed-seconds="currentSettlement.elapsedSeconds"
    :coins-awarded="currentSettlement.coinsAwarded"
    :passed="currentSettlement.passed === true"
    :can-advance="settlementCanAdvance"
    @return-hub="screen = 'hub'"
    @next-level="startNextLevel"
    @retry-level="retryCurrentLevel"
  />
  <PlayerActionDrawer
    v-if="activePanel"
    :panel="activePanel"
    :api="api"
    :selected-game-items="selectedGameItems"
    @close="activePanel = ''"
    @wallet-changed="refreshPlayerState"
    @game-item-toggle="toggleGameItem"
  />
  <EnergyInsufficientDialog v-if="energyNotice" :remaining-seconds="energyRemainingSeconds" @close="energyNotice = false" />
  </div>
</template>

<script>
// 引入三个页面级组件；引入后还要在 components 中注册才能在模板使用。
import AuthPanel from './components/AuthPanel.vue'
import LegalDocument from './components/LegalDocument.vue'
import GameHub from './components/GameHub.vue'
import LevelSelector from './components/LevelSelector.vue'
import { apiClient } from './services/api.js'
import PlayerActionDrawer from './components/PlayerActionDrawer.vue'
import AdminConsole from './components/AdminConsole.vue'
import EnergyInsufficientDialog from './components/EnergyInsufficientDialog.vue'
import GameBoard from './components/GameBoard.vue'
import SettlementPanel from './components/SettlementPanel.vue'
import ProfilePage from './components/ProfilePage.vue'

export default {
  // name 主要用于 Vue Devtools 和错误提示中识别这个组件。
  name: 'App',
  // 注册局部组件，模板中的 <AuthPanel>、<GameHub>、<LevelSelector> 才能生效。
  components: {
    AuthPanel,
    LegalDocument,
    GameHub,
    LevelSelector,
    GameBoard,
    SettlementPanel,
    ProfilePage,
    PlayerActionDrawer,
    AdminConsole,
    EnergyInsufficientDialog,
  },
  props: {
    api: { type: Object, default: () => apiClient },
  },
  data() {
    // data 必须返回一个对象；对象中的字段会成为响应式数据。
    return {
      // 页面流程：登录页 auth -> 大厅 hub -> 普通模式关卡页 levels。
      // 修改 screen 后，Vue 会自动重新渲染模板中的 v-if / v-else-if / v-else。
      screen: 'auth',
      playerState: { player: null, wallet: {}, progress: { normal: { highestUnlockedLevel: 0, levels: [] }, hard: { highestUnlockedLevel: 0, levels: [] } } },
      leaderboards: { endless: [], hard: [] },
      authError: '',
      authSubmitting: false,
      accountDisabledNotice: false,
      legalDocumentType: 'user',
      closePlayerStateStream: null,
      activePanel: '',
      currentMode: 'normal',
    currentGameEntry: null,
    currentLevel: null,
      selectedGameItems: [],
      currentSettlement: null,
      energyNotice: false,
      energyTick: Date.now(),
      energyClock: null,
      adminSection: 'overview',
      maintenanceEnabled: false,
      walletLedger: { items: [], page: 1, pageSize: 20, total: 0 },
    }
  },
  methods: {
    openLegalDocument(documentType) {
      this.legalDocumentType = documentType
      this.screen = 'legal'
    },
    // 登录组件只负责表单，登录成功后通过事件调用这里切换到大厅。
    async enterHub(credentials) {
      this.authError = ''
      this.accountDisabledNotice = false
      this.authSubmitting = true
      try {
        const response = credentials.mode === 'register'
          ? await this.api.register(credentials)
          : await this.api.login(credentials)
        localStorage.setItem('fruit-party-token', response.token)
        const [state, leaderboards] = await Promise.all([this.api.getPlayerState(), this.api.getLeaderboards()])
        this.playerState = state
        this.leaderboards = leaderboards
        this.closePlayerStateStream?.()
        if (typeof this.api.openPlayerStateStream === 'function') {
          this.closePlayerStateStream = this.api.openPlayerStateStream(
            (nextState) => { this.playerState = nextState },
            (nextLeaderboards) => { this.leaderboards = nextLeaderboards },
            () => {
              localStorage.removeItem('fruit-party-token')
              this.closePlayerStateStream?.()
              this.closePlayerStateStream = null
              this.screen = 'auth'
              this.authError = ''
              this.accountDisabledNotice = true
            },
            () => {},
            (status) => { this.maintenanceEnabled = Boolean(status?.enabled) },
          )
        }
        if (typeof this.api.getSystemStatus === 'function') {
          try { this.maintenanceEnabled = Boolean((await this.api.getSystemStatus())?.enabled) } catch { /* SSE will provide the next update */ }
        }
        this.screen = (response.player?.role || state.player.role) === 'admin' ? 'admin' : 'hub'
      } catch (error) {
        if (error.code === 'ACCOUNT_DISABLED') this.accountDisabledNotice = true
        else this.authError = error.message || '无法完成登录，请稍后再试'
      } finally {
        this.authSubmitting = false
      }
    },
    // mode 是大厅传来的模式名称，例如 normal / hard / endless。
    // 目前只有普通模式已经有 LevelSelector 页面，因此先切换到 levels。
    // 困难和无尽模式的真实游戏页面会在后续阶段补上对应分支。
    selectMode(mode) {
      if (mode === 'endless') {
        this.startEndless()
        return
      }
      if (['normal', 'hard'].includes(mode)) {
        this.currentMode = mode
        this.screen = 'levels'
      }
    },
    async startEndless() {
      try {
        this.currentMode = 'endless'
        const entry = await this.api.enterGame({ mode: 'endless', itemKeys: this.selectedGameItems })
        this.currentGameEntry = entry
        this.currentLevel = { number: 0, targetScore: 0 }
        this.selectedGameItems = []
        this.screen = 'game'
      } catch (error) {
        if (error.code === 'INSUFFICIENT_ENERGY') {
          this.energyNotice = true
          this.energyTick = Date.now()
        } else this.authError = error.message || '无法开始游戏'
      }
    },
    async startLevel(level) {
      try {
        const entry = await this.api.enterGame({ mode: this.currentMode, levelNumber: level.levelNumber, itemKeys: this.selectedGameItems })
        this.currentGameEntry = entry
        this.currentLevel = { number: level.levelNumber, targetScore: level.targetScore }
        this.selectedGameItems = []
        this.playerState = {
          ...this.playerState,
          wallet: {
            ...this.playerState.wallet,
            energy: entry.energy,
            maxEnergy: entry.maxEnergy,
            energyRecoveryStartedAt: entry.energyRecoveryStartedAt,
          },
        }
        this.screen = 'game'
      } catch (error) {
        if (error.code === 'INSUFFICIENT_ENERGY') {
          this.energyNotice = true
          this.energyTick = Date.now()
        } else {
          this.authError = error.message || '无法开始游戏'
        }
      }
    },
    async finishGame(round) {
      try {
        const hitRate = round.appearedCount > 0 ? round.slicedCount / round.appearedCount : 0
        const settlement = await this.api.settleGame({
          sessionId: this.currentGameEntry?.sessionId,
          mode: round.mode,
          levelNumber: round.mode === 'endless' ? undefined : round.level,
          fruitHits: round.fruitHits,
          hitRate,
          elapsedSeconds: round.mode === 'endless' ? round.elapsedSeconds : Math.max(0, round.roundSeconds - round.timeLeft),
        })
        this.currentSettlement = { ...settlement, mode: round.mode, levelNumber: round.level }
        await this.refreshPlayerState()
        this.screen = 'settlement'
      } catch (error) {
        this.authError = error.message || '本局结算失败，请稍后再试'
        this.screen = 'levels'
      }
    },
    async useReviveCard() {
      try {
        if (this.currentGameEntry?.sessionId && typeof this.api.reviveGameSession === 'function') await this.api.reviveGameSession(this.currentGameEntry.sessionId)
        else await this.api.useInventoryItem('revive-card')
        await this.refreshPlayerState()
        this.$refs.gameBoard?.resumeAfterRevive()
      } catch (error) {
        this.$refs.gameBoard?.rejectRevive(error.message || '复活卡使用失败，请稍后重试')
      }
    },
    async activateGameItem(itemKey) {
      try {
        if (this.currentGameEntry?.sessionId && typeof this.api.activateGameItem === 'function') {
          const result = await this.api.activateGameItem(this.currentGameEntry.sessionId, itemKey)
          this.$refs.gameBoard?.confirmItemActivation(result)
        } else this.$refs.gameBoard?.confirmItemActivation({ itemKey, durationSeconds: 20 })
      } catch (error) {
        this.$refs.gameBoard?.rejectItemActivation(error.message || '道具使用失败，请稍后重试')
      }
    },
    async startNextLevel() {
      const nextLevelNumber = Number(this.currentLevel?.number) + 1
      const nextLevel = this.playerState.progress[this.currentMode]?.levels?.find((level) => level.levelNumber === nextLevelNumber)
      if (nextLevel?.unlocked) await this.startLevel(nextLevel)
      else this.screen = 'levels'
    },
    async retryCurrentLevel() {
      const level = this.playerState.progress[this.currentMode]?.levels?.find((entry) => entry.levelNumber === this.currentSettlement?.levelNumber)
      if (level) await this.startLevel(level)
      else this.screen = 'levels'
    },
    openPlayerPanel(panel) {
      if (panel === 'profile') {
        this.screen = 'profile'
        this.refreshWalletLedger()
        return
      }
      this.activePanel = panel
    },
    toggleGameItem(itemKey) {
      const selected = new Set(this.selectedGameItems)
      if (selected.has(itemKey)) selected.delete(itemKey)
      else selected.add(itemKey)
      this.selectedGameItems = [...selected]
    },
    async updateProfile(profile) {
      try {
        this.playerState = await this.api.updateProfile(profile)
      } catch (error) {
        this.authError = error.message || '资料保存失败，请稍后再试'
      }
    },
    async refreshPlayerState() {
      try { this.playerState = await this.api.getPlayerState() } catch { /* SSE reconnect or next navigation will retry */ }
    },
    async refreshWalletLedger() {
      try { this.walletLedger = await this.api.getWalletLedger({ page: 1, pageSize: 20 }) } catch { /* profile keeps the last known ledger */ }
    },
    async setTestingMode(enabled) {
      try { this.playerState = await this.api.setTestingMode(enabled) } catch (error) { this.authError = error.message || '无法切换内测特权' }
    },
    async toggleMaintenance(enabled) {
      if (typeof this.api.updateAdminMaintenance !== 'function') {
        this.maintenanceEnabled = enabled
        return
      }
      try {
        const status = await this.api.updateAdminMaintenance({ enabled })
        this.maintenanceEnabled = Boolean(status.enabled)
      } catch (error) {
        this.authError = error.message || '维护状态更新失败，请稍后重试'
      }
    },
    logout() {
      localStorage.removeItem('fruit-party-token')
      this.closePlayerStateStream?.()
      this.closePlayerStateStream = null
      this.playerState = { player: null, wallet: {}, progress: { normal: { highestUnlockedLevel: 0, levels: [] }, hard: { highestUnlockedLevel: 0, levels: [] } } }
      this.screen = 'auth'
    },
  },
  computed: {
    highestLevel() {
      return this.playerState.progress.normal.highestUnlockedLevel
    },
    energyRemainingSeconds() {
      const wallet = this.playerState.wallet || {}
      if (Number(wallet.energy) >= Number(wallet.maxEnergy) || !wallet.energyRecoveryStartedAt) return 0
      const recoveryAt = new Date(wallet.energyRecoveryStartedAt).valueOf() + 10 * 60 * 1000
      return Math.max(0, Math.ceil((recoveryAt - this.energyTick) / 1000))
    },
    reviveCount() {
      return Number(this.playerState.inventory?.find((item) => item.itemKey === 'revive-card')?.quantity || 0)
    },
    settlementCanAdvance() {
      if (!this.currentSettlement || this.currentSettlement.mode === 'endless') return false
      if (this.currentSettlement.passed) return true
      const level = this.playerState.progress[this.currentSettlement.mode]?.levels?.find((entry) => entry.levelNumber === this.currentSettlement.levelNumber)
      return Boolean(level?.completedAt)
    },
  },
  mounted() {
    this.energyClock = window.setInterval(() => { this.energyTick = Date.now() }, 1000)
  },
  beforeDestroy() {
    this.closePlayerStateStream?.()
    window.clearInterval(this.energyClock)
  },
}
</script>
