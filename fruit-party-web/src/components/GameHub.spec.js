// 排行榜测试：先验证用户在大厅里能展开与收起这个侧边功能。
import { mount } from '@vue/test-utils'
import GameHub from './GameHub.vue'

describe('GameHub', () => {
  it('常驻显示排行榜、模式入口和右上角导航', async () => {
    const wrapper = mount(GameHub, {
      propsData: {
        player: { username: '真实玩家', isTester: true },
        wallet: { coins: 580, energy: 3, maxEnergy: 5 },
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
    expect(wrapper.emitted('open-panel')).toEqual([['recharge']])
    expect(wrapper.get('[data-test="leaderboard-panel"]').isVisible()).toBe(true)
    expect(wrapper.find('[data-test="leaderboard-toggle"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('排行榜')
    expect(wrapper.text()).toContain('真实玩家')
    expect(wrapper.get('[data-test="tester-account"]').text()).toContain('内测账号')
    expect(wrapper.get('[data-test="coin-balance"]').text()).toContain('580')
    expect(wrapper.get('[data-test="energy-count"]').text()).toBe('3/5')
    expect(wrapper.findAll('.energy-bars .is-filled')).toHaveLength(3)
    expect(wrapper.text()).toContain('水果达人')
    expect(wrapper.text()).not.toContain('闯关进度')
    expect(wrapper.text()).not.toContain('最高连击')
    expect(wrapper.text()).not.toContain('累计切中')
    expect(wrapper.text()).toContain('普通模式')
    expect(wrapper.text()).toContain('困难模式')
    expect(wrapper.text()).toContain('无尽模式')
    expect(wrapper.text()).not.toContain('今日任务')
  })

  it('allows a tester to switch persistent test privileges on and off', async () => {
    const wrapper = mount(GameHub, {
      propsData: {
        player: { username: 'tester', isTester: true, testingModeEnabled: true },
        wallet: { coins: 1000, energy: 5, maxEnergy: 5 },
        leaderboards: { endless: [], hard: [] },
        highestLevel: 10,
      },
    })

    expect(wrapper.get('[data-test="testing-mode-toggle"]').text()).toContain('内测模式')
    expect(wrapper.find('[data-test="testing-mode-status"]').exists()).toBe(false)
    await wrapper.get('[data-test="testing-mode-toggle"]').trigger('click')

    expect(wrapper.emitted('toggle-testing-mode')).toEqual([[false]])
  })

  it('opens the player profile from the identity card', async () => {
    const wrapper = mount(GameHub, {
      propsData: { player: { username: '真实玩家' }, wallet: { coins: 0, energy: 5, maxEnergy: 5 }, leaderboards: { endless: [], hard: [] } },
    })

    await wrapper.get('[data-test="profile-button"]').trigger('click')

    expect(wrapper.emitted('open-panel')).toEqual([['profile']])
  })
})
