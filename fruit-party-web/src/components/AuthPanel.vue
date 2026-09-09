<template>
  <!-- 认证组件只负责表单状态，并将成功事件交给父组件处理。 -->
  <main class="auth-page">
    <!-- 水果装饰不参与交互。 -->
    <span class="fruit fruit-watermelon" aria-hidden="true">🍉</span>
    <span class="fruit fruit-orange" aria-hidden="true">🍊</span>
    <span class="fruit fruit-strawberry" aria-hidden="true">🍓</span>

    <section class="auth-card" aria-labelledby="auth-title">
      <p class="brand">FRUIT PARTY</p>
      <h1 id="auth-title">{{ title }}</h1>
      <p class="intro">挥出第一刀，开始你的水果旅程。</p>

      <!-- mode 决定当前标签、标题、按钮文案和确认密码字段。 -->
      <div class="tabs" role="tablist" aria-label="认证方式">
        <button
          class="tab"
          :class="{ 'is-active': mode === 'login' }"
          type="button"
          role="tab"
          data-test="login-tab"
          :aria-selected="mode === 'login'"
          @click="mode = 'login'"
        >
          登录
        </button>
        <button
          class="tab"
          :class="{ 'is-active': mode === 'register' }"
          type="button"
          role="tab"
          data-test="register-tab"
          :aria-selected="mode === 'register'"
          @click="mode = 'register'"
        >
          注册
        </button>
      </div>

      <!-- 阻止默认提交，再向父组件发送假登录事件。 -->
      <form @submit.prevent="submitAuth">
        <label>
          用户名
          <input v-model.trim="form.username" type="text" autocomplete="username" placeholder="输入用户名" required />
        </label>
        <label>
          密码
          <input v-model="form.password" type="password" autocomplete="current-password" placeholder="输入密码" required />
        </label>
        <!-- 注册模式才需要确认密码。 -->
        <label v-if="mode === 'register'">
          确认密码
          <input v-model="form.confirmPassword" type="password" autocomplete="new-password" placeholder="再次输入密码" required />
        </label>

        <button class="submit-button" type="submit" data-test="enter-hub">
          {{ submitText }}
        </button>
      </form>
    </section>
  </main>
</template>

<script>
export default {
  name: 'AuthPanel',
  data() {
    return {
      // 当前认证模式。
      mode: 'login',
      form: {
        username: '',
        password: '',
        confirmPassword: '',
      },
    }
  },
  computed: {
    // 根据 mode 生成界面文案。
    title() {
      return this.mode === 'login' ? '欢迎回来' : '创建账号'
    },
    submitText() {
      return this.mode === 'login' ? '进入游戏大厅' : '创建并进入大厅'
    },
  },
  methods: {
    submitAuth() {
      // 当前阶段用事件模拟登录成功。
      this.$emit('enter')
    },
  },
}
</script>

<style scoped>
/* 深蓝为主，紫光只用于局部层次。 */
.auth-page {
  position: relative;
  display: grid;
  min-height: 100vh;
  place-items: center;
  overflow: hidden;
  padding: 32px 20px;
  background: radial-gradient(circle at 82% 18%, #2c2563 0, #14264a 30%, #081529 74%);
}

.fruit {
  position: absolute;
  z-index: 0;
  opacity: 0.22;
  font-size: 80px;
  filter: drop-shadow(0 12px 12px #0008);
  pointer-events: none;
}

.fruit-watermelon { left: 10%; top: 13%; transform: rotate(-16deg); }
.fruit-orange { right: 10%; top: 24%; transform: rotate(14deg); }
.fruit-strawberry { left: 16%; bottom: 12%; transform: rotate(10deg); }

.auth-card {
  position: relative;
  z-index: 1;
  width: min(100%, 370px);
  padding: 30px;
  border: 1px solid #58709b;
  border-radius: 8px;
  background: #101f3ce8;
  box-shadow: 0 22px 54px #020716a8;
}

.brand {
  margin: 0 0 8px;
  color: #ffd36a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
}

h1 { margin: 0; color: #f7f9ff; font-size: 28px; }
.intro { margin: 9px 0 22px; color: #afc0db; font-size: 13px; }

.tabs { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 22px; border-bottom: 1px solid #4c6289; }
.tab { padding: 10px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #9eafc7; }
.tab.is-active { border-bottom-color: #ffd36a; color: #ffffff; font-weight: 700; }

label { display: grid; gap: 7px; margin: 14px 0; color: #c8d5e8; font-size: 12px; }
input { width: 100%; min-height: 42px; padding: 0 12px; border: 1px solid #516a94; border-radius: 5px; outline: none; background: #0a1730; color: #f7f9ff; }
input:focus { border-color: #ffd36a; box-shadow: 0 0 0 2px #ffd36a33; }

.submit-button { width: 100%; min-height: 44px; margin-top: 10px; border: 0; border-radius: 5px; background: #f0644f; color: #ffffff; font-weight: 700; }
.submit-button:hover { background: #d84f40; }
</style>
