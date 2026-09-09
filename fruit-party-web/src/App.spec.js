// 顶层流程测试：假登录后进入大厅，并从大厅进入按顺序锁定的关卡选择。
import { mount } from '@vue/test-utils'
import App from './App.vue'

async function enterHub(wrapper) {
  // 表单带 required 属性，测试先填入内容再提交，模拟真实用户行为。
  await wrapper.get('input[autocomplete="username"]').setValue('fruit-player')
  await wrapper.get('input[type="password"]').setValue('12345678')
  await wrapper.get('form').trigger('submit.prevent')
}

describe('App', () => {
  it('初始显示登录入口', () => {
    const wrapper = mount(App)

    expect(wrapper.get('h1').text()).toBe('欢迎回来')
    expect(wrapper.get('[data-test="login-tab"]').classes()).toContain('is-active')
  })

  it('假登录后显示三种模式，并锁定尚未解锁的无尽模式', async () => {
    const wrapper = mount(App)

    await enterHub(wrapper)

    expect(wrapper.text()).toContain('水果新手')
    expect(wrapper.text()).toContain('普通模式')
    expect(wrapper.text()).toContain('困难模式')
    expect(wrapper.text()).toContain('无尽模式')
    expect(wrapper.get('[data-test="endless-lock"]').text()).toBe('未解锁')
  })

  it('进入闯关挑战后只让第一关可选', async () => {
    const wrapper = mount(App)

    await enterHub(wrapper)
    await wrapper.get('[data-test="normal-button"]').trigger('click')

    expect(wrapper.text()).toContain('选择关卡')
    expect(wrapper.get('[data-test="level-1"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-test="level-2"]').attributes('disabled')).toBeDefined()
  })
})
