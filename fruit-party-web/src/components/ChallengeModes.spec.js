import { mount } from '@vue/test-utils'
import ChallengeModes from './ChallengeModes.vue'

describe('ChallengeModes', () => {
  it('显示普通、困难、无尽三种模式', () => {
    const wrapper = mount(ChallengeModes, { propsData: { highestLevel: 1 } })

    expect(wrapper.get('[data-test="normal-button"]').text()).toContain('普通模式')
    expect(wrapper.get('[data-test="normal-button"]').text()).toContain('十关挑战')
    expect(wrapper.get('[data-test="hard-button"]').text()).toContain('困难模式')
    expect(wrapper.get('[data-test="endless-button"]').text()).toContain('无尽模式')
  })

  it('普通模式未完成五关时锁定无尽模式', async () => {
    const wrapper = mount(ChallengeModes, { propsData: { highestLevel: 1 } })

    await wrapper.get('[data-test="normal-button"]').trigger('click')
    expect(wrapper.emitted('select-mode')[0]).toEqual(['normal'])
    expect(wrapper.get('[data-test="endless-button"]').attributes('disabled')).toBe('disabled')
    expect(wrapper.get('[data-test="endless-lock"]').text()).toBe('未解锁')
  })

  it('普通模式完成第五关后开放无尽模式', async () => {
    const wrapper = mount(ChallengeModes, { propsData: { highestLevel: 5 } })

    expect(wrapper.get('[data-test="endless-button"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-test="endless-button"]').trigger('click')
    expect(wrapper.emitted('select-mode')[0]).toEqual(['endless'])
  })
})
