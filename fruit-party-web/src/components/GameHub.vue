<template>
  <!-- GameHub 是大厅页面容器，只负责排版和组件组合，不处理子区域细节。 -->
  <main class="game-hub">
    <!-- 全局入口浮在大厅右上角，商店、通知和充值页面后续分别实现。 -->
    <TopNavigation
      :coins="wallet.coins"
      :energy="wallet.energy"
      :energy-remaining-seconds="energyRemainingSeconds"
      :infinite-coins="Boolean(player?.isTester && player?.testingModeEnabled)"
      :infinite-energy="Boolean(player?.isTester && player?.testingModeEnabled)"
      @open-panel="$emit('open-panel', $event)"
    />
    <aside class="profile-panel">
      <!-- 玩家资料来自 App 已加载的服务端状态。 -->
      <button class="profile-button" type="button" data-test="profile-button" title="个人主页" @click="$emit('open-panel', 'profile')">
        <span class="avatar" aria-hidden="true">{{ playerAvatar }}</span>
        <span>
          <strong>{{ player ? player.username : '加载中' }}</strong>
          <span v-if="player?.isTester" data-test="tester-account" class="tester-account">内测账号</span>
          <small>个人主页</small>
        </span>
      </button>
      <button
        v-if="player?.isTester"
        type="button"
        data-test="testing-mode-toggle"
        class="testing-mode-toggle"
        :aria-pressed="Boolean(player.testingModeEnabled)"
        @click="$emit('toggle-testing-mode', !player.testingModeEnabled)"
      >
        <span class="toggle-track" aria-hidden="true"><i /></span>
        <span>内测模式</span>
      </button>
      <LeaderboardPanel :endless-players="leaderboards.endless" :hard-players="leaderboards.hard" />
    </aside>

    <section class="challenge-panel" aria-labelledby="challenge-title">
      <h1 id="challenge-title">选择挑战</h1>
      <!-- highestLevel 决定无尽模式是否可用；select-mode 再原样交给 App.vue 统一处理页面跳转。 -->
      <ChallengeModes :highest-level="highestLevel" @select-mode="$emit('select-mode', $event)" />
    </section>

    <button class="hub-backpack-button" type="button" data-test="hub-backpack-button" title="背包" @click="$emit('open-panel', 'inventory')">
      <span aria-hidden="true">▣</span>
      <span>背包</span>
    </button>
  </main>
</template>

<script>
// 子组件各自负责一个功能区，GameHub 只负责把它们组装起来。
import LeaderboardPanel from './LeaderboardPanel.vue'
import ChallengeModes from './ChallengeModes.vue'
import TopNavigation from './TopNavigation.vue'

export default {
  name: 'GameHub',
  // 注册后，模板才可以使用这些组件标签。
  components: { LeaderboardPanel, ChallengeModes, TopNavigation },
  props: {
    player: { type: Object, default: null },
    wallet: {
      type: Object,
      default: () => ({ coins: 0, energy: 0, maxEnergy: 5 }),
    },
    leaderboards: {
      type: Object,
      default: () => ({ endless: [], hard: [] }),
    },
    // 最高普通关卡由 App.vue 持有；默认值令组件单独测试时模拟新玩家。
    highestLevel: {
      type: Number,
      default: 1,
    },
    energyRemainingSeconds: { type: Number, default: 0 },
  },
  computed: {
    playerAvatar() {
      return this.player?.username?.slice(0, 1) || '…'
    },
  },
}
</script>

<style scoped>
/* scoped 让这些布局样式只属于 GameHub，不影响登录页等其他组件。 */
/* 近黑蓝作为统一底色，低对比纹理保留“幽蓝”气氛而不抢走模式卡的颜色。 */
.game-hub { display: grid; grid-template-columns: minmax(310px, 42%) minmax(420px, 58%); min-height: 100vh; overflow: hidden; background-color: #060b16; background-image: repeating-linear-gradient(135deg, #15284c22 0 1px, transparent 1px 78px), repeating-linear-gradient(45deg, transparent 0 116px, #18345814 116px 117px); }
/* 排行榜使用 absolute 定位，所以父级必须是 position: relative。 */
.profile-panel { position: relative; min-height: 100%; padding: 28px 24px; border-right: 1px solid #283a57; background: #080f1d66; }
.profile-button { position: relative; z-index: 1; display: flex; align-items: center; gap: 11px; border: 0; background: transparent; color: #eff5ff; text-align: left; }
.avatar { display: grid; width: 48px; height: 48px; place-items: center; border: 2px solid #d6ad4c; border-radius: 50%; background: #1c3153; font-size: 23px; }
.profile-button strong, .profile-button small { display: block; } .profile-button strong { font-size: 17px; } .profile-button small { margin-top: 3px; color: #a9bbd4; font-size: 12px; }
.tester-account { display: inline-flex; align-items: center; min-height: 18px; margin: 4px 0 0; padding: 0 6px; border: 1px solid #5b4824; border-radius: 4px; background: #201b10; color: #e4bd55; font-size: 11px; line-height: 1; }
.testing-mode-toggle { position: relative; z-index: 2; display: inline-flex; min-height: 30px; align-items: center; gap: 8px; margin: 12px 0 18px; padding: 0; border: 0; background: transparent; color: #aebed4; font: inherit; font-size: 12px; cursor: pointer; }
.toggle-track { position: relative; width: 31px; height: 17px; border: 1px solid #52647e; border-radius: 9px; background: #111b2b; transition: 160ms ease; }
.toggle-track i { position: absolute; top: 2px; left: 2px; width: 11px; height: 11px; border-radius: 50%; background: #8290a6; transition: 160ms ease; }
.testing-mode-toggle[aria-pressed="true"] .toggle-track { border-color: #b9943e; background: #403117; }
.testing-mode-toggle[aria-pressed="true"] .toggle-track i { left: 16px; background: #f0cb6d; }
/* 右侧用 flex 垂直居中，让状态、挑战和动态形成一个完整内容中枢。 */
.challenge-panel { display: flex; flex-direction: column; justify-content: center; padding: 42px; background: transparent; }
.challenge-panel > * { width: min(590px, 100%); align-self: center; }
.challenge-panel h1 { margin: 0 0 18px; font-size: 21px; }
.hub-backpack-button { position: absolute; right: 34px; bottom: 28px; z-index: 3; display: inline-flex; min-width: 88px; min-height: 38px; align-items: center; justify-content: center; gap: 7px; padding: 0 14px; border: 1px solid #71603a; border-radius: 6px; background: #0b1424e6; box-shadow: 0 8px 20px #0005; color: #e9d18a; font: inherit; font-size: 12px; cursor: pointer; }.hub-backpack-button > span:first-child { color: #d6b65b; font-size: 17px; line-height: 1; }.hub-backpack-button:hover { border-color: #b89a50; background: #17253a; color: #fff1bd; }
@media (max-width: 700px) { .game-hub { grid-template-columns: 1fr; } .profile-panel { min-height: 160px; padding: 28px 20px; border-right: 0; border-bottom: 1px solid #3d659a; } .challenge-panel { display: block; padding: 28px 20px 84px; } .challenge-panel > * { width: 100%; } .hub-backpack-button { right: 14px; bottom: 14px; } }
</style>
