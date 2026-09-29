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

      <!-- 父组件负责网络请求，本组件只负责输入校验和清晰的错误反馈。 -->
      <form @submit.prevent="submitAuth">
        <label>
          用户名
          <input v-model.trim="form.username" type="text" autocomplete="username" placeholder="输入用户名" required />
        </label>
        <label>
          密码
          <span class="password-field">
            <input v-model="form.password" :type="visiblePasswords.login ? 'text' : 'password'" :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" placeholder="输入密码" required />
            <button
              class="password-visibility-toggle"
              :class="{ 'is-visible': visiblePasswords.login }"
              type="button"
              data-test="toggle-login-password"
              :aria-label="visiblePasswords.login ? '隐藏密码' : '显示密码'"
              :title="visiblePasswords.login ? '隐藏密码' : '显示密码'"
              @click="visiblePasswords.login = !visiblePasswords.login"
            ><span class="eye-icon" aria-hidden="true"></span></button>
          </span>
        </label>
        <!-- 注册模式才需要确认密码。 -->
        <label v-if="mode === 'register'">
          确认密码
          <span class="password-field">
            <input v-model="form.confirmPassword" :type="visiblePasswords.confirm ? 'text' : 'password'" autocomplete="new-password" placeholder="再次输入密码" required />
            <button
              class="password-visibility-toggle"
              :class="{ 'is-visible': visiblePasswords.confirm }"
              type="button"
              data-test="toggle-confirm-password"
              :aria-label="visiblePasswords.confirm ? '隐藏密码' : '显示密码'"
              :title="visiblePasswords.confirm ? '隐藏密码' : '显示密码'"
              @click="visiblePasswords.confirm = !visiblePasswords.confirm"
            ><span class="eye-icon" aria-hidden="true"></span></button>
          </span>
        </label>
        <div class="terms-label">
          <input id="accepted-terms" v-model="form.acceptedTerms" type="checkbox" />
          <label for="accepted-terms">我已阅读并同意</label>
          <button class="terms-link" type="button" data-test="user-agreement" @click="$emit('open-legal', 'user')">《用户协议》</button>
          <span>和</span>
          <button class="terms-link" type="button" data-test="privacy-policy" @click="$emit('open-legal', 'privacy')">《隐私政策》</button>
        </div>
        <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>

        <button class="submit-button" type="submit" data-test="enter-hub" :disabled="submitting">
          {{ submitText }}
        </button>
      </form>
    </section>

    <div v-if="termsConfirmationOpen" class="terms-confirm-backdrop" data-test="terms-confirm-dialog" @click.self="termsConfirmationOpen = false">
      <section class="terms-confirm-dialog" role="dialog" aria-modal="true" aria-label="确认同意协议">
        <p>使用本服务前，请阅读并同意《用户协议》和《隐私政策》。</p>
        <div><button type="button" @click="termsConfirmationOpen = false">暂不</button><button data-test="confirm-terms" type="button" @click="acceptTermsAndSubmit">同意并继续</button></div>
      </section>
    </div>
    <div v-if="accountDisabled" class="account-disabled-backdrop" data-test="account-disabled-dialog" @click.self="$emit('close-account-disabled')">
      <section class="account-disabled-dialog" role="dialog" aria-modal="true" aria-labelledby="account-disabled-title">
        <p class="account-disabled-kicker">账户状态异常</p>
        <h2 id="account-disabled-title">你的账户已被封禁</h2>
        <p>有疑问请联系管理人员，电话 <a href="tel:321-8888888">321-8888888</a></p>
        <button type="button" data-test="close-account-disabled" @click="$emit('close-account-disabled')">我知道了</button>
      </section>
    </div>

  </main>
</template>

<script>
export default {
  name: 'AuthPanel',
  props: {
    errorMessage: { type: String, default: '' },
    submitting: { type: Boolean, default: false },
    accountDisabled: { type: Boolean, default: false },
  },
  data() {
    return {
      // 当前认证模式。
      mode: 'login',
      form: {
        username: '',
        password: '',
        confirmPassword: '',
        acceptedTerms: false,
      },
      visiblePasswords: {
        login: false,
        confirm: false,
      },
      termsConfirmationOpen: false,
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
      if (!this.form.acceptedTerms) {
        this.termsConfirmationOpen = true
        return
      }
      if (this.mode === 'register' && this.form.password !== this.form.confirmPassword) {
        this.$emit('validation-error', '两次输入的密码不一致')
        return
      }
      this.$emit('authenticate', {
        mode: this.mode,
        username: this.form.username,
        password: this.form.password,
        acceptedTerms: this.form.acceptedTerms,
      })
    },
    acceptTermsAndSubmit() {
      this.form.acceptedTerms = true
      this.termsConfirmationOpen = false
      this.submitAuth()
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
.fruit-watermelon { animation: fruit-float 5.8s ease-in-out infinite; }
.fruit-orange { animation: fruit-float 6.4s ease-in-out 0.7s infinite reverse; }
.fruit-strawberry { animation: fruit-float 5.2s ease-in-out 1.1s infinite; }

.auth-card {
  position: relative;
  z-index: 1;
  width: min(100%, 370px);
  padding: 30px;
  border: 1px solid #58709b;
  border-radius: 8px;
  background: #101f3ce8;
  box-shadow: 0 22px 54px #020716a8;
  animation: surface-enter 420ms cubic-bezier(.2, .8, .2, 1) both;
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
input:focus { border-color: #516a94; box-shadow: none; }
.password-field { position: relative; display: block; }
.password-field input { padding-right: 46px; }
.password-visibility-toggle {
  position: absolute;
  top: 50%;
  right: 6px;
  display: grid;
  width: 32px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  place-items: center;
  transform: translateY(-50%);
  background: transparent;
  color: #8fa2c0;
}
.password-visibility-toggle:hover,
.password-visibility-toggle:focus-visible { background: #1b3157; color: #d9e5f7; outline: none; }
.eye-icon { position: relative; display: block; width: 17px; height: 10px; border: 1.5px solid currentColor; border-radius: 50%; }
.eye-icon::before { position: absolute; top: 50%; left: 50%; width: 4px; height: 4px; border-radius: 50%; transform: translate(-50%, -50%); background: currentColor; content: ''; }
.password-visibility-toggle:not(.is-visible) .eye-icon::after { position: absolute; top: 50%; left: -2px; width: 20px; height: 1.5px; transform: rotate(-34deg); transform-origin: center; background: currentColor; content: ''; }
.terms-label { display: flex; flex-wrap: wrap; align-items: center; gap: 0 4px; margin-top: 18px; color: #9fb0ca; font-size: 12px; line-height: 1.5; }
.terms-label input { flex: 0 0 16px; width: 16px; min-height: 16px; margin: 1px 0 0; padding: 0; accent-color: #f0644f; }
.terms-label label { display: inline; margin: 0 4px 0 0; color: inherit; font-size: inherit; }
.terms-link { display: inline; padding: 0; border: 0; background: transparent; color: #ffd36a; font: inherit; text-decoration: none; }
.terms-link:hover { color: #ffe2a0; text-decoration: underline; text-underline-offset: 2px; }
.auth-error { margin: 14px 0 0; padding: 9px 10px; border: 1px solid #a84952; border-radius: 5px; background: #4a2028; color: #ffd4d5; font-size: 12px; line-height: 1.5; }

.submit-button { width: 100%; min-height: 44px; margin-top: 10px; border: 0; border-radius: 5px; background: #f0644f; color: #ffffff; font-weight: 700; }
.submit-button:hover { background: #d84f40; box-shadow: 0 8px 16px #04091470; transform: translateY(-1px); }
.submit-button:disabled { cursor: wait; opacity: 0.65; }
.terms-confirm-backdrop { position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; padding: 20px; background: #020716b8; }
.terms-confirm-dialog { width: min(320px, 100%); padding: 20px; border: 1px solid #516a94; border-radius: 7px; background: #101f3c; box-shadow: 0 20px 52px #020716b8; color: #d7e1f1; font-size: 13px; line-height: 1.65; }.terms-confirm-dialog p { margin: 0; }.terms-confirm-dialog div { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 18px; }.terms-confirm-dialog button { min-height: 36px; border: 1px solid #516a94; border-radius: 5px; background: #0a1730; color: #c8d5e8; cursor: pointer; }.terms-confirm-dialog button:last-child { border-color: #ef6653; background: #f0644f; color: #fff; font-weight: 700; }
.account-disabled-backdrop { position: fixed; inset: 0; z-index: 11; display: grid; place-items: center; padding: 20px; background: #020716c9; }.account-disabled-dialog { width: min(360px, 100%); padding: 24px; border: 1px solid #96545b; border-top: 3px solid #e16a62; border-radius: 7px; background: #161d31; box-shadow: 0 22px 60px #020716c9; color: #e7edf8; text-align: center; }.account-disabled-kicker { margin: 0 0 8px; color: #e58078; font-size: 11px; font-weight: 700; letter-spacing: 1px; }.account-disabled-dialog h2 { margin: 0; font-size: 22px; }.account-disabled-dialog > p:not(.account-disabled-kicker) { margin: 12px 0 20px; color: #b9c6d9; font-size: 13px; line-height: 1.7; }.account-disabled-dialog a { color: #ffd36a; font-weight: 700; text-decoration: none; }.account-disabled-dialog button { width: 100%; min-height: 40px; border: 1px solid #d4665f; border-radius: 5px; background: #b94f4d; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }.account-disabled-dialog button:hover { background: #cd5a55; }.account-disabled-dialog button:focus-visible { outline: 2px solid #ffd36a; outline-offset: 3px; }
</style>
