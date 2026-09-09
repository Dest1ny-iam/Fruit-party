<template>
  <!-- 大厅固定左右布局：个人信息在左，玩家主要操作在右。 -->
  <main class="game-hub">
    <aside class="profile-panel">
      <!-- 后续会跳转个人主页；当前先提供清晰的入口和按钮语义。 -->
      <button class="profile-button" type="button" title="个人主页">
        <span class="avatar" aria-hidden="true">🙂</span>
        <span>
          <strong>水果新手</strong>
          <small>个人主页</small>
        </span>
      </button>

      <p class="progress">闯关进度 <strong>0 / 5</strong></p>

      <!-- 装饰水果透明且禁用指针事件，保证不影响头像和模式按钮点击。 -->
      <span class="background-fruit watermelon" aria-hidden="true">🍉</span>
      <span class="background-fruit orange" aria-hidden="true">🍊</span>
    </aside>

    <section class="challenge-panel" aria-labelledby="challenge-title">
      <h1 id="challenge-title">选择挑战</h1>

      <!-- 闯关入口向父组件发出事件，由 App 决定切换到关卡选择页面。 -->
      <button class="challenge-card campaign" type="button" data-test="campaign-button" @click="$emit('select-campaign')">
        <span class="mode-label">CAMPAIGN</span>
        <strong>闯关挑战</strong>
        <small>第 1 关</small>
        <span class="fruit-icon" aria-hidden="true">🍎</span>
        <span class="arrow" aria-hidden="true">→</span>
      </button>

      <!-- disabled 阻止点击；通过第 5 关后会由真实进度数据移除这个状态。 -->
      <button class="challenge-card endless" type="button" disabled>
        <span class="mode-label">ENDLESS</span>
        <strong>无尽挑战</strong>
        <small>通关第 5 关解锁</small>
        <span class="fruit-icon" aria-hidden="true">🍇</span>
        <span class="lock" data-test="endless-lock">锁定</span>
      </button>
    </section>
  </main>
</template>

<script>
export default {
  name: 'GameHub',
}
</script>

<style scoped>
/* 深蓝是主色，蓝紫色只用于边框和局部光影，保持黑暗幽蓝氛围。 */
.game-hub {
  display: grid;
  grid-template-columns: minmax(260px, 39%) minmax(0, 61%);
  min-height: 100vh;
  overflow: hidden;
  background: #09172d;
}

.profile-panel {
  position: relative;
  min-height: 100%;
  overflow: hidden;
  padding: 28px;
  border-right: 1px solid #3b5278;
  background: #0b1930;
}

.profile-button {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 11px;
  border: 0;
  background: transparent;
  color: #eff5ff;
  text-align: left;
}

.avatar {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 2px solid #ffd36a;
  border-radius: 50%;
  background: #29436d;
  font-size: 21px;
}

.profile-button strong,
.profile-button small { display: block; }
.profile-button small { margin-top: 3px; color: #a9bbd4; font-size: 11px; }

.progress {
  position: relative;
  z-index: 1;
  margin: 180px 0 0;
  color: #c6d4e7;
  font-size: 13px;
}

.progress strong { color: #ffd36a; }

.background-fruit {
  position: absolute;
  z-index: 0;
  opacity: 0.16;
  font-size: 88px;
  filter: drop-shadow(0 10px 12px #010610);
  pointer-events: none;
}

.watermelon { bottom: 10%; left: 4%; transform: rotate(-20deg); }
.orange { top: 25%; right: -17%; transform: rotate(22deg); }

.challenge-panel {
  padding: 40px 30px;
  background: radial-gradient(circle at 88% 8%, #29255d 0, #122648 38%, #0a1830 78%);
}

h1 { margin: 0 0 24px; font-size: 21px; }

.challenge-card {
  position: relative;
  display: block;
  width: 100%;
  min-height: 140px;
  margin: 15px 0;
  padding: 21px;
  overflow: hidden;
  border: 1px solid #506991;
  border-radius: 7px;
  background: #172b4d;
  color: #f7f9ff;
  text-align: left;
  box-shadow: inset 0 1px #ffffff12;
}

.campaign:hover { border-color: #ffd36a; background: #1c345a; }
.challenge-card:disabled { border-color: #415575; background: #10203c; color: #b0bfd3; cursor: not-allowed; opacity: 0.72; }

.mode-label,
.challenge-card strong,
.challenge-card small { display: block; }
.mode-label { color: #ffd36a; font-size: 10px; font-weight: 700; letter-spacing: 1px; }
.challenge-card strong { margin: 9px 0 6px; font-size: 19px; }
.challenge-card small { color: #b7c7dd; font-size: 12px; }

.fruit-icon { position: absolute; top: 16px; right: 21px; opacity: 0.62; font-size: 43px; }
.arrow { position: absolute; right: 21px; bottom: 16px; color: #ffd36a; font-size: 23px; }
.lock { position: absolute; right: 15px; bottom: 14px; padding: 5px 8px; border: 1px solid #7e95b8; border-radius: 4px; background: #0a1529; font-size: 11px; }

@media (max-width: 700px) {
  .game-hub { grid-template-columns: 1fr; }
  .profile-panel { min-height: 160px; border-right: 0; border-bottom: 1px solid #3b5278; }
  .progress { margin-top: 65px; }
  .challenge-panel { padding: 28px 20px; }
}
</style>
