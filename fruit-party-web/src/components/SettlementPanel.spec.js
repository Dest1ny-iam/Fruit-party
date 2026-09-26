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
  })
})
