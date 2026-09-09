<template>
  <!-- screen 是页面总开关；每个页面细节都留在自己的组件里。 -->
  <AuthPanel v-if="screen === 'auth'" @enter="enterHub" />
  <GameHub v-else-if="screen === 'hub'" @select-campaign="screen = 'levels'" />
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
  },
}
</script>
