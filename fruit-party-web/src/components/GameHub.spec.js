// 排行榜测试：先验证用户在大厅里能展开与收起这个侧边功能。
import { mount } from '@vue/test-utils'
import GameHub from './GameHub.vue'

describe('GameHub', () => {
  it('常驻显示排行榜、模式入口和右上角导航', async () => {
    const wrapper = mount(GameHub, {
      propsData: {
        player: { username: '真实玩家' },
        highestLevel: 1,
        leaderboards: {
          endless: [{ rank: 1, avatar: '水', name: '水果达人', score: 98420 }],
          hard: [],
        },
      },
    })

    expect(wrapper.get('[data-test="shop-button"]').text()).toContain('商店')
    expect(wrapper.get('[data-test="notifications-button"]').text()).toContain('通知')
    expect(wrapper.get('[data-test="recharge-button"]').text()).toContain('充值')

    await wrapper.get('[data-test="recharge-button"]').trigger('click')
    expect(wrapper.get('[data-test="recharge-message"]').text()).toBe('未开发')
    expect(wrapper.get('[data-test="leaderboard-panel"]').isVisible()).toBe(true)
    expect(wrapper.find('[data-test="leaderboard-toggle"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('排行榜')
    expect(wrapper.text()).toContain('真实玩家')
    expect(wrapper.text()).toContain('水果达人')
    expect(wrapper.text()).not.toContain('闯关进度')
    expect(wrapper.text()).not.toContain('最高连击')
    expect(wrapper.text()).not.toContain('累计切中')
    expect(wrapper.text()).toContain('普通模式')
    expect(wrapper.text()).toContain('困难模式')
    expect(wrapper.text()).toContain('无尽模式')
    expect(wrapper.text()).not.toContain('今日任务')
  })
})
