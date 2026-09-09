import { mount } from '@vue/test-utils'
import LeaderboardPanel from './LeaderboardPanel.vue'
import { endlessRankingPlayers, hardRankingPlayers } from '../data/lobby-data'

describe('LeaderboardPanel', () => {
  it('显示排行榜标题、前三名和当前排名', () => {
    const wrapper = mount(LeaderboardPanel, {
      propsData: { endlessPlayers: endlessRankingPlayers, hardPlayers: hardRankingPlayers },
    })

    expect(wrapper.text()).toContain('排行榜')
    expect(wrapper.text()).toContain('水果达人')
    expect(wrapper.text()).toContain('一刀两半')
    expect(wrapper.text()).toContain('你的当前排名')
    expect(wrapper.text()).toContain('无尽模式')
    expect(wrapper.text()).toContain('98,420')
  })

  it('可以切换到困难模式关数榜', async () => {
    const wrapper = mount(LeaderboardPanel, {
      propsData: { endlessPlayers: endlessRankingPlayers, hardPlayers: hardRankingPlayers },
    })

    await wrapper.get('[data-test="hard-ranking-tab"]').trigger('click')

    expect(wrapper.text()).toContain('困难模式')
    expect(wrapper.text()).toContain('通关 5 关')
    expect(wrapper.text()).not.toContain('98,420')
  })
})
