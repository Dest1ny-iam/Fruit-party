import { mount } from '@vue/test-utils'
import SettlementPanel from './SettlementPanel.vue'

describe('SettlementPanel', () => {
  it('renders only a centered return-to-hub action for endless mode', () => {
    const wrapper = mount(SettlementPanel, { propsData: { mode: 'endless', finalScore: 1250 } })

    expect(wrapper.get('[data-test="settlement-actions"]').classes()).toContain('is-endless')
    expect(wrapper.get('[data-test="return-hub"]').text()).toBe('返回大厅')
    expect(wrapper.find('[data-test="next-level"]').exists()).toBe(false)
  })

  it('keeps next-level navigation for passed campaign modes', () => {
    const wrapper = mount(SettlementPanel, { propsData: { mode: 'normal', finalScore: 585, passed: true } })

    expect(wrapper.get('[data-test="next-level"]').text()).toBe('下一关')
    const actions = wrapper.findAll('[data-test="settlement-actions"] button').wrappers
    expect(actions.map((button) => button.attributes('data-test'))).toEqual(['return-hub', 'next-level'])
  })

  it('restores the complete server-authoritative score breakdown for campaign modes', () => {
    const wrapper = mount(SettlementPanel, {
      propsData: {
        mode: 'normal',
        finalScore: 1500,
        baseScore: 1000,
        performanceScore: 500,
        targetScore: 1200,
        hitRate: 0.8,
        coinsAwarded: 65,
        passed: true,
      },
    })

    expect(wrapper.get('[data-test="score-details"]').text()).toContain('基础分')
    expect(wrapper.get('[data-test="score-details"]').text()).toContain('表现加分')
    expect(wrapper.get('[data-test="score-details"]').text()).toContain('命中率')
    expect(wrapper.get('[data-test="score-details"]').text()).toContain('80%')
    expect(wrapper.get('[data-test="score-details"]').text()).toContain('金币获得')
    expect(wrapper.get('[data-test="coin-reward-icon"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="coins-awarded"]').text()).toContain('+65')
  })

  it('restores endless time and the base-plus-performance equation', () => {
    const wrapper = mount(SettlementPanel, {
      propsData: { mode: 'endless', finalScore: 1500, baseScore: 1000, performanceScore: 500, elapsedSeconds: 75 },
    })

    expect(wrapper.get('[data-test="endless-score-breakdown"]').text()).toContain('本局用时 01:15')
    expect(wrapper.get('[data-test="endless-score-breakdown"]').text()).toContain('基础分')
    expect(wrapper.get('[data-test="endless-score-breakdown"]').text()).toContain('综合评分')
  })
})
