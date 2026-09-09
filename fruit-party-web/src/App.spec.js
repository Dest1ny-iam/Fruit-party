// 顶层组件测试：验证认证页显示与假登录后状态切换。
import { mount } from '@vue/test-utils'
import App from './App.vue'

describe('App', () => {
  it('初始显示登录入口', () => {
    const wrapper = mount(App)

    expect(wrapper.get('h1').text()).toBe('欢迎回来')
    expect(wrapper.get('[data-test="login-tab"]').classes()).toContain('is-active')
  })

  it('假登录后显示当前玩家名称', async () => {
    const wrapper = mount(App)

    // 先满足浏览器表单的 required 约束，再提交，模拟真实的假登录流程。
    await wrapper.get('input[autocomplete="username"]').setValue('fruit-player')
    await wrapper.get('input[type="password"]').setValue('12345678')
    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('水果新手')
  })
})
