import { mount } from '@vue/test-utils'
import LevelSelector from './LevelSelector.vue'

describe('LevelSelector', () => {
  it('只展示服务端已解锁的关卡', () => {
    const wrapper = mount(LevelSelector, {
      propsData: {
        levels: [
          { levelNumber: 1, targetScore: 500, unlocked: true },
          { levelNumber: 2, targetScore: 700, unlocked: false },
        ],
      },
    })

    expect(wrapper.find('[data-test="level-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="level-2"]').exists()).toBe(false)
  })

  it('普通玩家在上一关未通关时不展示被历史数据提前解锁的下一关', () => {
    const wrapper = mount(LevelSelector, {
      propsData: {
        levels: [
          { levelNumber: 1, targetScore: 500, unlocked: true, completedAt: null },
          { levelNumber: 2, targetScore: 700, unlocked: true, completedAt: null },
        ],
      },
    })

    expect(wrapper.find('[data-test="level-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="level-2"]').exists()).toBe(false)
  })

  it('保留内测账号直达全部服务端已解锁关卡的能力', () => {
    const wrapper = mount(LevelSelector, {
      propsData: {
        allowAllLevels: true,
        levels: [
          { levelNumber: 1, targetScore: 500, unlocked: true, completedAt: null },
          { levelNumber: 2, targetScore: 700, unlocked: true, completedAt: null },
        ],
      },
    })

    expect(wrapper.find('[data-test="level-2"]').exists()).toBe(true)
  })

  it('为已通关关卡展示原版进度信息和再次挑战入口', () => {
    const wrapper = mount(LevelSelector, {
      propsData: {
        levels: [
          { levelNumber: 1, targetScore: 500, unlocked: true, bestScore: 1234, completedAt: '2026-09-28T10:00:00.000Z' },
        ],
      },
    })

    const level = wrapper.find('[data-test="level-1"]')
    expect(level.text()).toContain('通关')
    expect(level.text()).toContain('最佳 1,234 分')
    expect(level.text()).toContain('再次挑战')
  })

  it('为未挑战关卡展示首次挑战状态', () => {
    const wrapper = mount(LevelSelector, {
      propsData: {
        levels: [
          { levelNumber: 1, targetScore: 500, unlocked: true, bestScore: 0, completedAt: null },
        ],
      },
    })

    const level = wrapper.find('[data-test="level-1"]')
    expect(level.text()).toContain('尚未挑战')
    expect(level.text()).toContain('开始挑战')
  })
})
