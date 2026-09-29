<template>
  <div ref="root" class="admin-select">
    <button
      :data-test="dataTest"
      class="admin-select-trigger"
      type="button"
      aria-haspopup="listbox"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      @click="toggleMenu"
      @keydown="handleKeydown"
    >
      <span>{{ selectedOption.label }}</span>
      <span class="admin-select-chevron" aria-hidden="true">⌄</span>
    </button>

    <div v-if="open" class="admin-select-menu" role="listbox" :aria-label="ariaLabel">
      <button
        v-for="(option, index) in options"
        :key="option.value"
        :data-test="`${dataTest}-option-${option.value}`"
        :class="['admin-select-option', { 'is-selected': option.value === modelValue, 'is-active': index === activeIndex }]"
        type="button"
        role="option"
        :aria-selected="option.value === modelValue"
        @mouseenter="activeIndex = index"
        @click="selectOption(option)"
      >
        <span>{{ option.label }}</span>
        <i class="admin-select-marker" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AdminSelect',
  emits: ['update:model-value', 'change'],
  props: {
    modelValue: { type: [String, Number], required: true },
    options: { type: Array, required: true },
    dataTest: { type: String, required: true },
    ariaLabel: { type: String, required: true },
  },
  data() {
    return { open: false, activeIndex: 0 }
  },
  computed: {
    selectedOption() {
      return this.options.find((option) => option.value === this.modelValue) || this.options[0] || { label: '' }
    },
  },
  mounted() {
    document.addEventListener('mousedown', this.closeFromOutside)
  },
  beforeUnmount() {
    document.removeEventListener('mousedown', this.closeFromOutside)
  },
  methods: {
    openMenu() {
      const selectedIndex = this.options.findIndex((option) => option.value === this.modelValue)
      this.activeIndex = selectedIndex >= 0 ? selectedIndex : 0
      this.open = true
    },
    toggleMenu() {
      if (this.open) this.open = false
      else this.openMenu()
    },
    selectOption(option) {
      this.$emit('update:model-value', option.value)
      this.$emit('change', option.value)
      this.open = false
    },
    closeFromOutside(event) {
      if (this.open && !this.$refs.root.contains(event.target)) this.open = false
    },
    handleKeydown(event) {
      if (event.key === 'Escape') {
        this.open = false
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (!this.open) this.openMenu()
        else {
          const direction = event.key === 'ArrowDown' ? 1 : -1
          this.activeIndex = (this.activeIndex + direction + this.options.length) % this.options.length
        }
        return
      }

      if ((event.key === 'Enter' || event.key === ' ') && this.open) {
        event.preventDefault()
        this.selectOption(this.options[this.activeIndex])
      }
    },
  },
}
</script>

<style scoped>
.admin-select {
  position: relative;
  min-width: 140px;
}

.admin-select-trigger,
.admin-select-option {
  width: 100%;
  border: 0;
  color: #dce6f2;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.admin-select-trigger {
  display: flex;
  min-height: 34px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 11px;
  border: 1px solid #3b506b;
  background: #111c2c;
  font-size: 11px;
}

.admin-select-trigger:focus-visible {
  border-color: #b89a50;
  outline: 2px solid #b89a5033;
  outline-offset: 1px;
}

.admin-select-chevron {
  color: #879ab2;
  font-size: 15px;
  line-height: 1;
  transition: transform 160ms ease;
}

.admin-select-trigger[aria-expanded='true'] .admin-select-chevron {
  transform: rotate(180deg);
}

.admin-select-menu {
  position: absolute;
  z-index: 30;
  top: calc(100% + 5px);
  right: 0;
  left: 0;
  overflow: hidden;
  border: 1px solid #405570;
  background: #0d1726;
  box-shadow: 0 12px 28px #02060dcc;
}

.admin-select-option {
  display: flex;
  min-height: 36px;
  align-items: center;
  justify-content: space-between;
  padding: 0 11px;
  background: #0d1726;
  font-size: 11px;
}

.admin-select-option + .admin-select-option {
  border-top: 1px solid #203149;
}

.admin-select-option.is-active {
  background: #18283b;
}

.admin-select-option.is-selected {
  background: #22344a;
  color: #f0d57f;
}

.admin-select-marker {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: transparent;
}

.admin-select-option.is-selected .admin-select-marker {
  background: #d0ae57;
  box-shadow: 0 0 0 3px #d0ae5718;
}
</style>
