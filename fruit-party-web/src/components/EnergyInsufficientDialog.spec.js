import { mount } from '@vue/test-utils'
import EnergyInsufficientDialog from './EnergyInsufficientDialog.vue'

describe('EnergyInsufficientDialog', () => {
  it('shows the server-derived recovery countdown and closes on request', async () => {
    const wrapper = mount(EnergyInsufficientDialog, { propsData: { remainingSeconds: 125 } })

    expect(wrapper.get('[data-test="energy-recovery-countdown"]').text()).toBe('02:05')
    await wrapper.get('[data-test="close-energy-dialog"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
