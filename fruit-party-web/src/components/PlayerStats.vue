<template>
  <!-- 用一条横向基线呈现玩家最关心的三个实时数据。 -->
  <div class="player-stats" data-test="player-stats" aria-label="玩家数据">
    <!-- key 使用稳定的 label，帮助 Vue 正确复用每一项 DOM。 -->
    <div v-for="stat in stats" :key="stat.label" class="stat-item">
      <span>{{ stat.label }}</span><strong>{{ stat.value }}</strong>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PlayerStats',
  // stats 由 GameHub 传入，子组件只负责展示，不修改父组件数据。
  props: { stats: { type: Array, required: true } },
}
</script>

<style scoped>
.player-stats { display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; margin-bottom: 25px; border-top: 1px solid #4372ad; border-bottom: 1px solid #4372ad; }
.stat-item { padding: 12px 17px; border-right: 1px solid #4372ad; } .stat-item:last-child { border-right: 0; }
.stat-item span, .stat-item strong { display: block; } .stat-item span { color: #a6b8d2; font-size: 11px; } .stat-item strong { margin-top: 4px; color: #f1d274; font-size: 16px; }
</style>
