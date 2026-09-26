// 顶层流程测试：假登录后进入大厅，并从大厅进入按顺序锁定的关卡选择。
import { mount } from '@vue/test-utils'
import App from './App.vue'

async function enterHub(wrapper) {
  await wrapper.get('input[autocomplete="username"]').setValue('tester')
  await wrapper.get('input[type="password"]').setValue('Tester123')
  await wrapper.get('input[type="checkbox"]').setChecked()
  await wrapper.get('form').trigger('submit.prevent')
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function api() {
  return {
    login: async () => ({ token: 'test-token' }),
    getPlayerState: async () => ({
      player: { username: '真实玩家' },
      wallet: { coins: 0 },
      progress: {
        normal: {
          highestUnlockedLevel: 1,
          levels: [
            { levelNumber: 1, targetScore: 180, unlocked: true },
            { levelNumber: 2, targetScore: 290, unlocked: false },
          ],
        },
        hard: { highestUnlockedLevel: 1, levels: [] },
      },
    }),
    getLeaderboards: async () => ({ endless: [], hard: [] }),
  }
}

describe('App', () => {
  it('初始显示登录入口', () => {
    const wrapper = mount(App, { propsData: { api: api() } })

    expect(wrapper.get('h1').text()).toBe('欢迎回来')
    expect(wrapper.get('[data-test="login-tab"]').classes()).toContain('is-active')
  })

  it('登录后显示服务端返回的玩家和模式状态', async () => {
    const wrapper = mount(App, { propsData: { api: api() } })

    await enterHub(wrapper)

    expect(wrapper.text()).toContain('真实玩家')
    expect(wrapper.text()).toContain('普通模式')
    expect(wrapper.text()).toContain('困难模式')
    expect(wrapper.text()).toContain('无尽模式')
    expect(wrapper.get('[data-test="endless-lock"]').text()).toBe('未解锁')
  })

  it('进入闯关挑战后只让第一关可选', async () => {
    const wrapper = mount(App, { propsData: { api: api() } })

    await enterHub(wrapper)
    await wrapper.get('[data-test="normal-button"]').trigger('click')

    expect(wrapper.text()).toContain('选择关卡')
    expect(wrapper.get('[data-test="level-1"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-test="level-2"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).not.toContain('锁定')
  })
})
