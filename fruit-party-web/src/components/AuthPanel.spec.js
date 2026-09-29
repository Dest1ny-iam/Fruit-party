// 认证卡片测试：验证标签切换和向父组件发送进入大厅事件。
import { mount } from '@vue/test-utils'
import AuthPanel from './AuthPanel.vue'
import AuthPanelSource from './AuthPanel.vue?raw'
import BaseStyles from '../styles/base.css?raw'

describe('AuthPanel', () => {
  it('点击注册标签后切换到注册表单', async () => {
    const wrapper = mount(AuthPanel)

    await wrapper.get('[data-test="register-tab"]').trigger('click')

    expect(wrapper.get('h1').text()).toBe('创建账号')
    expect(wrapper.get('button[type="submit"]').text()).toBe('创建并进入大厅')
  })

  it('提交表单时把登录信息交给父组件处理', async () => {
    const wrapper = mount(AuthPanel)
    await wrapper.get('input[autocomplete="username"]').setValue('tester')
    await wrapper.get('input[type="password"]').setValue('Tester123')
    await wrapper.get('input[type="checkbox"]').setChecked()

    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('authenticate')).toEqual([[{
      mode: 'login', username: 'tester', password: 'Tester123', acceptedTerms: true,
    }]])
  })

  it('未勾选协议时先显示确认弹窗，同意后自动勾选并继续提交', async () => {
    const wrapper = mount(AuthPanel)
    await wrapper.get('input[autocomplete="username"]').setValue('tester')
    await wrapper.get('input[type="password"]').setValue('Tester123')

    await wrapper.get('form').trigger('submit.prevent')
    expect(wrapper.get('[data-test="terms-confirm-dialog"]').exists()).toBe(true)
    expect(wrapper.emitted('authenticate')).toBeUndefined()

    await wrapper.get('[data-test="confirm-terms"]').trigger('click')
    expect(wrapper.get('input[type="checkbox"]').element.checked).toBe(true)
    expect(wrapper.emitted('authenticate')).toEqual([[{
      mode: 'login', username: 'tester', password: 'Tester123', acceptedTerms: true,
    }]])
  })

  it('密码输入框聚焦时不显示醒目的金色提示', () => {
    expect(AuthPanelSource).toContain('input:focus { border-color: #516a94; box-shadow: none; }')
    expect(BaseStyles).not.toContain('input:focus-visible')
  })

  it('点击用户协议后请求打开独立阅读页且不误勾选同意项', async () => {
    const wrapper = mount(AuthPanel)

    await wrapper.get('[data-test="user-agreement"]').trigger('click')

    expect(wrapper.emitted('open-legal')).toEqual([['user']])
    expect(wrapper.get('input[type="checkbox"]').element.checked).toBe(false)
  })

  it('协议复选框保持在文本左侧，不占满整行', () => {
    expect(AuthPanelSource).toContain('.terms-label input { flex: 0 0 16px; width: 16px;')
  })

  it('点击密码可见性按钮时可显示并重新隐藏登录密码', async () => {
    const wrapper = mount(AuthPanel)
    const password = wrapper.get('input[autocomplete="current-password"]')
    const toggle = wrapper.get('[data-test="toggle-login-password"]')

    expect(password.attributes('type')).toBe('password')
    expect(toggle.attributes('aria-label')).toBe('显示密码')

    await toggle.trigger('click')

    expect(password.attributes('type')).toBe('text')
    expect(toggle.attributes('aria-label')).toBe('隐藏密码')

    await toggle.trigger('click')

    expect(password.attributes('type')).toBe('password')
  })

  it('注册表单的两个密码框可分别切换显示状态', async () => {
    const wrapper = mount(AuthPanel)
    await wrapper.get('[data-test="register-tab"]').trigger('click')

    const toggles = wrapper.findAll('[data-test^="toggle-"]')
    expect(toggles).toHaveLength(2)

    await toggles.at(1).trigger('click')

    expect(wrapper.get('input[autocomplete="new-password"]').attributes('type')).toBe('password')
    expect(wrapper.get('input[placeholder="再次输入密码"]').attributes('type')).toBe('text')
  })
})
