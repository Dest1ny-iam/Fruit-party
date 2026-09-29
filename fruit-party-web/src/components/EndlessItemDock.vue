<template>
  <aside v-if="items.length" class="endless-item-dock" aria-label="无尽模式主动道具" @pointerdown.stop @pointermove.stop @click.stop>
    <button
      v-for="item in items"
      :key="item.id"
      :data-test="`activate-endless-${item.id}`"
      :class="{ active: remainingByItem[item.id] > 0, used: usedItemIds.includes(item.id) }"
      type="button"
      :disabled="usedItemIds.includes(item.id)"
      :aria-label="`使用${item.name}`"
      @click="$emit('activate', item.id)"
    >
      <span aria-hidden="true">{{ item.icon }}</span>
      <strong v-if="remainingByItem[item.id] > 0">{{ remainingByItem[item.id] }}s</strong>
      <small v-else>{{ usedItemIds.includes(item.id) ? '已使用' : '使用' }}</small>
    </button>
  </aside>
</template>

<script>
import { ITEM_BY_ID } from '../data/item-data'

export default {
  name: 'EndlessItemDock',
  emits: ['activate'],
  props: {
    itemIds: { type: Array, default: () => [] },
    usedItemIds: { type: Array, default: () => [] },
    remainingByItem: { type: Object, default: () => ({}) },
  },
  computed: {
    items() {
      return this.itemIds.filter((id) => ['bomb-shield', 'score-boost'].includes(id)).map((id) => ITEM_BY_ID[id]).filter(Boolean)
    },
  },
}
</script>

<style scoped>
.endless-item-dock { position: absolute; z-index: 7; top: 18px; left: 18px; display: flex; gap: 9px; pointer-events: none; }
button { display: grid; width: 52px; height: 52px; padding: 4px; place-items: center; align-content: center; border: 1px solid #6d5940; border-radius: 50%; background: #0b1628e8; box-shadow: 0 5px 15px #0008; color: #ebcf79; cursor: pointer; pointer-events: auto; }
button span { font-size: 18px; line-height: 1; }button small, button strong { margin-top: 3px; color: #aebdd0; font-size: 8px; line-height: 1; }
button.active { border-color: #e5bd55; box-shadow: 0 0 0 2px #e5bd5530, 0 5px 15px #0008; }button.active strong { color: #ffe08a; font-size: 10px; }
button:disabled { cursor: default; opacity: .72; }button.used:not(.active) { border-color: #344b69; color: #70839c; }
@media (max-width: 600px) { .endless-item-dock { top: 12px; left: 12px; }.endless-item-dock button { width: 46px; height: 46px; } }
</style>
