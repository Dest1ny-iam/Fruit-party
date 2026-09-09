<template>
  <!-- GameHub 是大厅页面容器，只负责排版和组件组合，不处理子区域细节。 -->
  <main class="game-hub">
    <!-- 全局入口浮在大厅右上角，商店、通知和充值页面后续分别实现。 -->
    <TopNavigation />
    <aside class="profile-panel">
      <!-- 个人主页按钮目前使用假用户资料，点击逻辑留到个人主页阶段。 -->
      <button class="profile-button" type="button" title="个人主页">
        <span class="avatar" aria-hidden="true">🙂</span>
        <span><strong>水果新手</strong><small>个人主页</small></span>
      </button>
      <!-- 两份榜单数据经由 props 传入排行榜，子组件只负责切换与显示。 -->
      <LeaderboardPanel :endless-players="endlessRankingPlayers" :hard-players="hardRankingPlayers" />
    </aside>

    <section class="challenge-panel" aria-labelledby="challenge-title">
      <h1 id="challenge-title">选择挑战</h1>
      <!-- highestLevel 决定无尽模式是否可用；select-mode 再原样交给 App.vue 统一处理页面跳转。 -->
      <ChallengeModes :highest-level="highestLevel" @select-mode="$emit('select-mode', $event)" />
    </section>
  </main>
</template>

<script>
// 子组件各自负责一个功能区，GameHub 只负责把它们组装起来。
import LeaderboardPanel from './LeaderboardPanel.vue'
import ChallengeModes from './ChallengeModes.vue'
import TopNavigation from './TopNavigation.vue'
import { endlessRankingPlayers, hardRankingPlayers } from '../data/lobby-data'

export default {
  name: 'GameHub',
  // 注册后，模板才可以使用这些组件标签。
  components: { LeaderboardPanel, ChallengeModes, TopNavigation },
  props: {
    // 最高普通关卡由 App.vue 持有；默认值令组件单独测试时模拟新玩家。
    highestLevel: {
      type: Number,
      default: 1,
    },
  },
  data() {
    // data 返回响应式对象；将来接口数据变化时，页面会自动更新。
    return { endlessRankingPlayers, hardRankingPlayers }
  },
}
</script>

<style scoped>
/* scoped 让这些布局样式只属于 GameHub，不影响登录页等其他组件。 */
/* 近黑蓝作为统一底色，低对比纹理保留“幽蓝”气氛而不抢走模式卡的颜色。 */
.game-hub { display: grid; grid-template-columns: minmax(310px, 42%) minmax(420px, 58%); min-height: 100vh; overflow: hidden; background-color: #060b16; background-image: repeating-linear-gradient(135deg, #15284c22 0 1px, transparent 1px 78px), repeating-linear-gradient(45deg, transparent 0 116px, #18345814 116px 117px); }
/* 排行榜使用 absolute 定位，所以父级必须是 position: relative。 */
.profile-panel { position: relative; min-height: 100%; padding: 28px 34px; border-right: 1px solid #283a57; background: #080f1d66; }
.profile-button { position: relative; z-index: 1; display: flex; align-items: center; gap: 11px; border: 0; background: transparent; color: #eff5ff; text-align: left; }
.avatar { display: grid; width: 43px; height: 43px; place-items: center; border: 2px solid #d6ad4c; border-radius: 50%; background: #1c3153; font-size: 21px; }
.profile-button strong, .profile-button small { display: block; } .profile-button small { margin-top: 3px; color: #a9bbd4; font-size: 11px; }
/* 右侧用 flex 垂直居中，让状态、挑战和动态形成一个完整内容中枢。 */
.challenge-panel { display: flex; flex-direction: column; justify-content: center; padding: 42px; background: transparent; }
.challenge-panel > * { width: min(590px, 100%); align-self: center; }
.challenge-panel h1 { margin: 0 0 18px; font-size: 21px; }
@media (max-width: 700px) { .game-hub { grid-template-columns: 1fr; } .profile-panel { min-height: 160px; padding: 28px 20px; border-right: 0; border-bottom: 1px solid #3d659a; } .challenge-panel { display: block; padding: 28px 20px; } .challenge-panel > * { width: 100%; } }
</style>
