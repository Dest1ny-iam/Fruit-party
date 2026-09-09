<template>
  <!-- screen 是页面总开关；每个页面细节都留在自己的组件里。 -->
  <AuthPanel v-if="screen === 'auth'" @enter="enterHub" />
  <GameHub v-else-if="screen === 'hub'" :highest-level="highestLevel" @select-mode="selectMode" />
  <LevelSelector v-else :highest-level="highestLevel" @back="screen = 'hub'" />
</template>

<script>
import AuthPanel from './components/AuthPanel.vue'
import GameHub from './components/GameHub.vue'
import LevelSelector from './components/LevelSelector.vue'

export default {
  name: 'App',
  components: {
    AuthPanel,
    GameHub,
    LevelSelector,
  },
  data() {
    return {
      // auth -> hub -> levels 是当前前端演示的页面流转。
      screen: 'auth',
      // 后端接入前用固定进度模拟新玩家：仅第一关解锁。
      highestLevel: 1,
    }
  },
  methods: {
    enterHub() {
      this.screen = 'hub'
    },
    // 普通模式已有五关选择页，因此立刻跳转；困难与无尽游戏页将在游戏阶段接入。
    selectMode(mode) {
      if (mode === 'normal') {
        this.screen = 'levels'
      }
    },
  },
}
</script>
