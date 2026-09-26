// 认证卡片测试：验证标签切换和向父组件发送进入大厅事件。
import { mount } from '@vue/test-utils'
import AuthPanel from './AuthPanel.vue'

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
})
