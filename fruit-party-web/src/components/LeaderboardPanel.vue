<template>
  <section class="leaderboard-panel" data-test="leaderboard-panel" aria-label="排行榜">
    <div class="leaderboard-plaque" aria-hidden="true">排行榜</div>

    <!-- 两个 tab 改变 rankingMode；列表通过计算属性自动读取对应的假数据。 -->
    <header class="leaderboard-header">
      <div class="ranking-tabs" role="tablist" aria-label="排行榜模式">
        <button
          class="ranking-tab"
          :class="{ 'is-active': rankingMode === 'endless' }"
          type="button"
          data-test="endless-ranking-tab"
          role="tab"
          :aria-selected="rankingMode === 'endless'"
          @click="rankingMode = 'endless'"
        >
          无尽模式
        </button>
        <button
          class="ranking-tab"
          :class="{ 'is-active': rankingMode === 'hard' }"
          type="button"
          data-test="hard-ranking-tab"
          role="tab"
          :aria-selected="rankingMode === 'hard'"
          @click="rankingMode = 'hard'"
        >
          困难模式
        </button>
      </div>
      <span class="leaderboard-kicker">{{ rankingSubtitle }}</span>
    </header>

    <!-- 有序列表表达“排名”的语义，v-for 负责依次渲染当前榜单玩家。 -->
    <ol class="rank-list">
      <li v-for="player in activePlayers" :key="player.name" class="rank-item" :class="`rank-${player.rank}`">
        <strong class="rank-number">{{ player.rank }}</strong>
        <span class="rank-avatar" aria-hidden="true">{{ player.avatar }}</span>
        <span class="rank-name">{{ player.name }}</span>
        <span class="rank-score">{{ player.score }}</span>
      </li>
    </ol>

    <p class="player-rank">你的当前排名 <strong># 26</strong></p>
  </section>
</template>

<script>
export default {
  name: 'LeaderboardPanel',
  props: {
    // 两份数组分别代表无尽分数榜和困难通关榜；由 GameHub 从数据文件传入。
    endlessPlayers: { type: Array, required: true },
    hardPlayers: { type: Array, required: true },
  },
  data() {
    // 默认值让大厅第一次进入时直接显示无尽模式分数榜。
    return { rankingMode: 'endless' }
  },
  computed: {
    // 模板不需要写条件判断，只消费最终应当展示的玩家数组。
    activePlayers() {
      return this.rankingMode === 'endless' ? this.endlessPlayers : this.hardPlayers
    },
    // 副标题随榜单变化，明确两种模式使用不同的排名规则。
    rankingSubtitle() {
      return this.rankingMode === 'endless' ? '按最高分排名' : '按通关关数排名'
    },
  },
}
</script>

<style scoped>
/* 排行榜位于左栏垂直中线；深色面板融入近黑的大厅背景。 */
.leaderboard-panel { position: absolute; top: 51%; left: 0; width: min(318px, calc(100% - 22px)); padding: 48px 20px 18px; border: 1px solid #3c5579; border-radius: 6px; background: #0a1325; box-shadow: 0 16px 28px #00030ecc; color: #eff5ff; transform: translateY(-50%); }
.leaderboard-plaque { position: absolute; top: -19px; left: 50%; z-index: 2; display: grid; width: 164px; height: 43px; place-items: center; border: 1px solid #d5ad4b; background: #17233a; color: #efd36f; font-size: 18px; font-weight: 700; letter-spacing: 2px; transform: translateX(-50%); clip-path: polygon(10% 0, 90% 0, 100% 22%, 94% 78%, 82% 100%, 18% 100%, 6% 78%, 0 22%); }
.leaderboard-plaque::before, .leaderboard-plaque::after { position: absolute; top: 50%; width: 24px; border-top: 1px solid #d5ad4b; content: ''; }
.leaderboard-plaque::before { right: calc(100% + 8px); }
.leaderboard-plaque::after { left: calc(100% + 8px); }
.leaderboard-header { padding-bottom: 12px; border-bottom: 1px solid #293d5d; }
.ranking-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.ranking-tab { min-height: 29px; border: 1px solid #344866; border-radius: 3px; background: #0d1a30; color: #98aac5; font-size: 11px; }
.ranking-tab.is-active { border-color: #d5ad4b; background: #2a2a24; color: #f4d771; }
.leaderboard-kicker { display: block; margin-top: 9px; color: #8496b2; font-size: 10px; letter-spacing: 1px; }
.rank-list { margin: 11px 0 0; padding: 0; list-style: none; }
.rank-item { display: grid; grid-template-columns: 25px 27px minmax(0, 1fr) auto; align-items: center; min-height: 43px; border-bottom: 1px solid #ffffff0d; font-size: 12px; }
.rank-number { display: grid; width: 20px; height: 20px; place-items: center; border: 1px solid #465d81; color: #b8c7dc; font-size: 10px; }
.rank-1 .rank-number { border-color: #efc85d; background: #765019; color: #fff2bb; }
.rank-2 .rank-number { border-color: #b9c8d8; background: #465b73; color: #f1f7ff; }
.rank-3 .rank-number { border-color: #c08a53; background: #68462d; color: #ffe0ba; }
.rank-avatar { display: grid; width: 22px; height: 22px; place-items: center; border-radius: 50%; background: #334678; font-size: 10px; }
.rank-name { overflow: hidden; padding-left: 8px; text-overflow: ellipsis; white-space: nowrap; }
.rank-score { color: #bdcae0; font-size: 11px; }
.player-rank { margin: 14px 0 0; color: #aebed5; font-size: 11px; }
.player-rank strong { margin-left: 4px; color: #f5d77c; }
@media (max-width: 700px) { .leaderboard-panel { position: relative; top: auto; width: 100%; margin-top: 62px; transform: none; } }
</style>
