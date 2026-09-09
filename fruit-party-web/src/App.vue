<template>
  <!-- App 只决定当前显示认证页还是大厅；具体表单细节由 AuthPanel 负责。 -->
  <AuthPanel v-if="screen === 'auth'" @enter="enterHub" />

  <!-- 这是第二页大厅完成前的临时落点，下一分支会用 GameHub 组件替换它。 -->
  <main v-else class="signed-in-page">
    <p class="signed-in-label">FRUIT PARTY</p>
    <h1>水果新手</h1>
    <p>已进入游戏大厅。</p>
  </main>
</template>

<script>
// 导入认证组件；App 不直接处理表单输入，因此组件边界更清晰。
import AuthPanel from './components/AuthPanel.vue'

export default {
  name: 'App',
  components: {
    AuthPanel,
  },
  data() {
    return {
      // screen 决定顶层页面。真实登录接口完成后，会由接口结果控制该状态。
      screen: 'auth',
    }
  },
  methods: {
    // AuthPanel 表单提交后发出 enter 事件，父组件在这里切换为假登录成功状态。
    enterHub() {
      this.screen = 'hub'
    },
  },
}
</script>

<style scoped>
/* 临时大厅页只用于验证父子组件事件；完整布局不提前写入本分支。 */
.signed-in-page {
  display: grid;
  place-content: center;
  min-height: 100vh;
  padding: 32px;
  text-align: center;
}

.signed-in-label {
  margin: 0 0 8px;
  color: #ffd36a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
}

h1 {
  margin: 0 0 10px;
}

p {
  margin: 0;
  color: #b8c7dc;
}
</style>
