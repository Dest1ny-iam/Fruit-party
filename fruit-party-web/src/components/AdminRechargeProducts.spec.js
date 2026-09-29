import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminRechargeProducts from './AdminRechargeProducts.vue'

const existing = {
  id: 'coins-1000', name: '1000 金币', price: 1, benefitType: 'coins', benefitAmount: 1000,
  description: '金币商品', enabled: true, sortOrder: 10, qrCodeImage: 'data:image/png;base64,old',
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('AdminRechargeProducts', () => {
  beforeEach(() => window.localStorage.clear())

  it('加载商品并允许编辑价格和在商品行启停状态', async () => {
    const saver = vi.fn().mockImplementation(async (product) => ({ ...product }))
    const wrapper = mount(AdminRechargeProducts, { propsData: { loader: () => Promise.resolve([{ ...existing, enabled: true }]), saver } })
    await flushPromises()

    await wrapper.get('[data-test="edit-recharge-coins-1000"]').trigger('click')
    expect(wrapper.get('[data-test="recharge-product-drawer"]').exists()).toBe(true)
    await wrapper.get('[data-test="recharge-price"]').setValue('2')
    expect(wrapper.find('[data-test="recharge-enabled"]').exists()).toBe(false)
    await wrapper.get('[data-test="save-recharge-product"]').trigger('click')
    await flushPromises()

    expect(saver).toHaveBeenCalledWith(expect.objectContaining({ id: 'coins-1000', price: 2, enabled: true }))

    await wrapper.get('[data-test="toggle-recharge-coins-1000"]').trigger('click')
    await flushPromises()
    expect(saver).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'coins-1000', enabled: false }))
  })

  it('将启用开关放在商品行的编辑按钮右侧，而不是编辑抽屉内', async () => {
    const wrapper = mount(AdminRechargeProducts, { propsData: { loader: () => Promise.resolve([{ ...existing, enabled: true }]) } })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(wrapper.get('[data-test="toggle-recharge-coins-1000"]').text()).toBe('停用')
    await wrapper.get('[data-test="edit-recharge-coins-1000"]').trigger('click')
    expect(wrapper.find('[data-test="recharge-enabled"]').exists()).toBe(false)
  })

  it('上传二维码后显示本地预览并随商品保存', async () => {
    const saver = vi.fn().mockImplementation(async (product) => product)
    const readerFactory = () => ({
      result: '',
      readAsDataURL() { this.result = 'data:image/png;base64,new-qr'; this.onload() },
    })
    const wrapper = mount(AdminRechargeProducts, {
      propsData: { loader: () => Promise.resolve([]), saver, readerFactory },
    })
    await flushPromises()

    expect(wrapper.find('[data-test="recharge-product-drawer"]').exists()).toBe(false)
    await wrapper.get('[data-test="new-recharge-product"]').trigger('click')
    await wrapper.get('[data-test="recharge-name"]').setValue('3000 金币')
    await wrapper.get('[data-test="recharge-price"]').setValue('3')
    await wrapper.get('[data-test="recharge-benefit-amount"]').setValue('3000')
    wrapper.vm.handleQrFile({ target: { files: [new File(['qr'], 'qr.png', { type: 'image/png' })] } })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-test="recharge-qr-preview"]').attributes('src')).toContain('new-qr')
    await wrapper.get('[data-test="save-recharge-product"]').trigger('click')
    await flushPromises()
    expect(saver).toHaveBeenCalledWith(expect.objectContaining({ qrCodeImage: 'data:image/png;base64,new-qr' }))
  })

  it('启用商品未上传二维码时显示错误且不保存', async () => {
    const saver = vi.fn().mockRejectedValue(new Error('请先上传收款二维码'))
    const wrapper = mount(AdminRechargeProducts, { propsData: { loader: () => Promise.resolve([]), saver } })
    await flushPromises()
    await wrapper.get('[data-test="new-recharge-product"]').trigger('click')
    await wrapper.get('[data-test="recharge-name"]').setValue('未配置商品')
    await wrapper.get('[data-test="save-recharge-product"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="recharge-form-error"]').text()).toContain('请先上传收款二维码')
  })

  it('永久权益隐藏无意义的权益数量', async () => {
    const wrapper = mount(AdminRechargeProducts, { propsData: { loader: () => Promise.resolve([]) } })
    await flushPromises()
    await wrapper.get('[data-test="new-recharge-product"]').trigger('click')

    await wrapper.get('[data-test="recharge-benefit-type"]').setValue('permanent-free-entry')

    expect(wrapper.find('[data-test="recharge-benefit-amount"]').exists()).toBe(false)
  })

  it('数字字段使用竖向黑底上下箭头而非原生白色步进器', async () => {
    const wrapper = mount(AdminRechargeProducts, { propsData: { loader: () => Promise.resolve([]) } })
    await flushPromises()
    await wrapper.get('[data-test="new-recharge-product"]').trigger('click')

    expect(wrapper.get('[data-test="recharge-price"]').attributes('type')).toBe('text')
    expect(wrapper.get('[data-test="recharge-sort-order"]').attributes('type')).toBe('text')
    expect(wrapper.get('[data-test="increase-recharge-benefit-amount"]').classes()).toContain('spinner-button')
    await wrapper.get('[data-test="increase-recharge-benefit-amount"]').trigger('click')
    expect(wrapper.get('[data-test="recharge-benefit-amount"]').element.value).toBe('1001')
    await wrapper.get('[data-test="decrease-recharge-benefit-amount"]').trigger('click')
    expect(wrapper.get('[data-test="recharge-benefit-amount"]').element.value).toBe('1000')

    await wrapper.get('[data-test="recharge-price"]').setValue('4.5')
    await wrapper.get('[data-test="increase-recharge-price"]').trigger('click')
    expect(wrapper.get('[data-test="recharge-price"]').element.value).toBe('5.5')
  })

  it('权益类型包含能量、道具和自定义权益', async () => {
    const wrapper = mount(AdminRechargeProducts, { propsData: { loader: () => Promise.resolve([]) } })
    await flushPromises()
    await wrapper.get('[data-test="new-recharge-product"]').trigger('click')

    const values = wrapper.findAll('[data-test="recharge-benefit-type"] option').wrappers.map((option) => option.element.value)
    expect(values).toEqual(expect.arrayContaining(['coins', 'energy', 'item', 'permanent-free-entry', 'custom']))
  })
})
