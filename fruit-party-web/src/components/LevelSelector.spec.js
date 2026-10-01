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

  it('uses fixed nine-card pages and switches pages through clicks or the mouse wheel', async () => {
    const levels = Array.from({ length: 10 }, (_, index) => ({
      levelNumber: index + 1,
      targetScore: 300 + index * 100,
      unlocked: true,
      completedAt: index === 0 ? '2026-09-28T10:00:00.000Z' : null,
    }))
    const wrapper = mount(LevelSelector, { propsData: { levels, allowAllLevels: true } })

    expect(wrapper.findAll('.level-button')).toHaveLength(9)
    expect(wrapper.get('[data-test="level-pagination"]').text()).toContain('第 1 / 2 页')

    await wrapper.get('[data-test="level-page-next"]').trigger('click')
    expect(wrapper.findAll('.level-button')).toHaveLength(1)
    expect(wrapper.find('[data-test="level-10"]').exists()).toBe(true)

    await wrapper.get('[data-test="level-grid"]').trigger('wheel', { deltaY: -120 })
    expect(wrapper.findAll('.level-button')).toHaveLength(9)
  })
})
