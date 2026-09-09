// 排行榜测试：先验证用户在大厅里能展开与收起这个侧边功能。
import { mount } from '@vue/test-utils'
import GameHub from './GameHub.vue'

describe('GameHub', () => {
  it('常驻显示排行榜和大厅状态信息', () => {
    const wrapper = mount(GameHub)

    expect(wrapper.get('[data-test="leaderboard-panel"]').isVisible()).toBe(true)
    expect(wrapper.find('[data-test="leaderboard-toggle"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('排行榜')
    expect(wrapper.text()).toContain('水果达人')
    expect(wrapper.text()).toContain('闯关进度')
    expect(wrapper.text()).toContain('普通模式')
    expect(wrapper.text()).toContain('困难模式')
    expect(wrapper.text()).toContain('无尽模式')
    expect(wrapper.text()).not.toContain('今日任务')
  })
})
