<template>
  <!--
    App.vue 是整个前端的根组件。
    它不负责绘制所有细节，只根据 screen 决定当前应该显示哪个页面。
  -->
  <!--
    v-if：当 screen 等于 auth 时显示登录注册组件。
    @enter：AuthPanel 登录成功后发出 enter 事件，调用 enterHub 方法。
  -->
  <AuthPanel
    v-if="screen === 'auth'"
    :error-message="authError"
    :submitting="authSubmitting"
    @authenticate="enterHub"
    @validation-error="authError = $event"
  />
  <!--
    v-else-if：只有前面的 v-if 不成立时才会判断这里。
    :highest-level：把普通模式最高关卡传给大厅，控制无尽模式是否解锁。
    @select-mode：大厅选择模式后把事件交回 App 统一处理页面跳转。
  -->
  <GameHub
    v-else-if="screen === 'hub'"
    :player="playerState.player"
    :leaderboards="leaderboards"
    :highest-level="highestLevel"
    @select-mode="selectMode"
  />
  <!--
    v-else：当前 screen 既不是 auth 也不是 hub 时显示关卡页。
    :highest-level：告诉关卡页哪些关卡可以点击。
    @back="screen = 'hub'"：点击返回大厅时直接修改 screen。
  -->
  <LevelSelector v-else-if="screen === 'levels'" :levels="playerState.progress.normal.levels" @back="screen = 'hub'" @start="startLevel" />
  <FruitScene v-else @back="screen = 'levels'" />
</template>

<script>
// 引入三个页面级组件；引入后还要在 components 中注册才能在模板使用。
import AuthPanel from './components/AuthPanel.vue'
import GameHub from './components/GameHub.vue'
import LevelSelector from './components/LevelSelector.vue'
import { apiClient } from './services/api.js'

export default {
  // name 主要用于 Vue Devtools 和错误提示中识别这个组件。
  name: 'App',
  // 注册局部组件，模板中的 <AuthPanel>、<GameHub>、<LevelSelector> 才能生效。
  components: {
    AuthPanel,
    GameHub,
    LevelSelector,
    FruitScene: () => import('./game/FruitScene.vue'),
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
      closePlayerStateStream: null,
    }
  },
  methods: {
    // 登录组件只负责表单，登录成功后通过事件调用这里切换到大厅。
    async enterHub(credentials) {
      this.authError = ''
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
          this.closePlayerStateStream = this.api.openPlayerStateStream((nextState) => {
            this.playerState = nextState
          })
        }
        this.screen = 'hub'
      } catch (error) {
        this.authError = error.message || '无法完成登录，请稍后再试'
      } finally {
        this.authSubmitting = false
      }
    },
    // mode 是大厅传来的模式名称，例如 normal / hard / endless。
    // 目前只有普通模式已经有 LevelSelector 页面，因此先切换到 levels。
    // 困难和无尽模式的真实游戏页面会在后续阶段补上对应分支。
    selectMode(mode) {
      if (mode === 'normal') {
        this.screen = 'levels'
      }
    },
    startLevel() {
      this.screen = 'game'
    },
  },
  computed: {
    highestLevel() {
      return this.playerState.progress.normal.highestUnlockedLevel
    },
  },
  beforeDestroy() {
    this.closePlayerStateStream?.()
  },
}
</script>
