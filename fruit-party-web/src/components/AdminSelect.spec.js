import { mount } from '@vue/test-utils'
import AdminSelect from './AdminSelect.vue'

const options = [
  { value: 'all', label: '全部事件' },
  { value: 'player', label: '玩家游戏' },
  { value: 'admin', label: '后台操作' },
]

describe('AdminSelect', () => {
  it('使用自定义菜单选择项目并更新绑定值', async () => {
    const wrapper = mount(AdminSelect, {
      propsData: { modelValue: 'all', options, dataTest: 'event-filter', ariaLabel: '事件类型' },
    })

    await wrapper.get('[data-test="event-filter"]').trigger('click')
    expect(wrapper.get('[role="listbox"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="event-filter-option-all"]').classes()).toContain('is-selected')

    await wrapper.get('[data-test="event-filter-option-player"]').trigger('click')
    expect(wrapper.emitted('update:model-value')[0]).toEqual(['player'])
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  })

  it('按 Escape 关闭已打开的菜单', async () => {
    const wrapper = mount(AdminSelect, {
      attachTo: document.body,
      propsData: { modelValue: 'all', options, dataTest: 'event-filter', ariaLabel: '事件类型' },
    })

    await wrapper.get('[data-test="event-filter"]').trigger('click')
    await wrapper.get('[data-test="event-filter"]').trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    wrapper.destroy()
  })
})
