import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TopNavigation from './TopNavigation.vue'

describe('TopNavigation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('充值提示显示三秒后自动消失', async () => {
    const wrapper = mount(TopNavigation)

    await wrapper.get('[data-test="recharge-button"]').trigger('click')
    expect(wrapper.get('[data-test="recharge-message"]').text()).toBe('未开发')

    vi.advanceTimersByTime(3000)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="recharge-message"]').exists()).toBe(false)
  })
})
