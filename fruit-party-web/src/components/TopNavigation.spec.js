import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TopNavigation from './TopNavigation.vue'

describe('TopNavigation', () => {
  it('renders the restored coin badge, five energy cells, and recovery countdown', () => {
    const wrapper = mount(TopNavigation, {
      propsData: { coins: 580, energy: 3, energyRemainingSeconds: 90 },
    })

    expect(wrapper.get('[data-test="coin-balance-icon"]').text()).toBe('¥')
    expect(wrapper.get('[data-test="coin-balance"]').text()).toContain('580')
    expect(wrapper.findAll('.energy-bars i')).toHaveLength(5)
    expect(wrapper.findAll('.energy-bars .is-filled')).toHaveLength(3)
    expect(wrapper.get('[data-test="energy-count"]').text()).toBe('3/5')
    expect(wrapper.get('[data-test="energy-recovery-countdown"]').text()).toBe('恢复 01:30')
  })

  it('emits the requested API-backed panel instead of a development placeholder', async () => {
    const wrapper = mount(TopNavigation)

    await wrapper.get('[data-test="shop-button"]').trigger('click')
    await wrapper.get('[data-test="notifications-button"]').trigger('click')
    await wrapper.get('[data-test="recharge-button"]').trigger('click')

    expect(wrapper.emitted('open-panel')).toEqual([['shop'], ['notifications'], ['recharge']])
    expect(wrapper.find('[data-test="recharge-message"]').exists()).toBe(false)
  })
})
