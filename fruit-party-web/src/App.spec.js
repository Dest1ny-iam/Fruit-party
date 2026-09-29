// 顶层流程测试：假登录后进入大厅，并从大厅进入按顺序锁定的关卡选择。
import { config, mount } from '@vue/test-utils'
import App from './App.vue'

config.stubs.GameBoard = { name: 'GameBoard', template: '<section data-test="game-board" />' }

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
    getShopItems: async () => [{ id: 1, displayName: '复活卡', description: '继续挑战。', priceCoins: 120 }],
    purchaseItem: async () => ({ remainingCoins: 0 }),
    getNotifications: async () => [],
    getRechargeProducts: async () => [],
    getAdminPlayers: async () => [],
  }
}

describe('App', () => {
  it('初始显示登录入口', () => {
    const wrapper = mount(App, { propsData: { api: api() } })

    expect(wrapper.get('h1').text()).toBe('欢迎回来')
    expect(wrapper.get('[data-test="login-tab"]').classes()).toContain('is-active')
  })

  it('禁用账号登录时显示封禁联系弹窗，而不是普通密码错误', async () => {
    const disabledApi = {
      ...api(),
      login: async () => {
        const error = new Error('该账号已被禁用')
        error.code = 'ACCOUNT_DISABLED'
        throw error
      },
    }
    const wrapper = mount(App, { propsData: { api: disabledApi } })

    await wrapper.vm.enterHub({ mode: 'login', username: 'disabled-player', password: 'Tester123', acceptedTerms: true })

    expect(wrapper.get('[data-test="account-disabled-dialog"]').text()).toContain('你的账户已被封禁')
    expect(wrapper.get('[data-test="account-disabled-dialog"]').text()).toContain('321-8888888')
    expect(wrapper.find('.auth-error').exists()).toBe(false)
  })

  it('点击协议后打开独立阅读页，并可返回登录页', async () => {
    const wrapper = mount(App, { propsData: { api: api() } })

    await wrapper.get('[data-test="user-agreement"]').trigger('click')

    expect(wrapper.get('[data-test="legal-document-page"]').text()).toContain('用户协议')
    await wrapper.get('[data-test="legal-back"]').trigger('click')
    expect(wrapper.get('h1').text()).toBe('欢迎回来')
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

  it('进入闯关挑战后只展示已解锁的第一关', async () => {
    const wrapper = mount(App, { propsData: { api: api() } })

    await enterHub(wrapper)
    await wrapper.get('[data-test="normal-button"]').trigger('click')

    expect(wrapper.text()).toContain('选择关卡')
    expect(wrapper.get('[data-test="level-1"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-test="level-2"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('锁定')
  })

  it('only charges energy after the player confirms a specific level', async () => {
    const entries = []
    const gameApi = {
      ...api(),
      enterGame: async (entry) => {
        entries.push(entry)
        return { sessionId: 'game-entry-1', chargedEnergy: 1, energy: 4, maxEnergy: 5, energyRecoveryStartedAt: '2026-09-28T00:00:00.000Z' }
      },
    }
    const wrapper = mount(App, { propsData: { api: gameApi } })

    await enterHub(wrapper)
    await wrapper.get('[data-test="normal-button"]').trigger('click')
    expect(entries).toEqual([])

    await wrapper.get('[data-test="level-1"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve))

    expect(entries).toEqual([{ mode: 'normal', levelNumber: 1, itemKeys: [] }])
    expect(wrapper.vm.playerState.wallet.energy).toBe(4)
  })

  it('starts the restored Three.js game board only after a server game entry succeeds', async () => {
    const gameApi = {
      ...api(),
      enterGame: async () => ({ sessionId: 'game-entry-1', chargedEnergy: 1, energy: 4, maxEnergy: 5, energyRecoveryStartedAt: '2026-09-28T00:00:00.000Z' }),
    }
    const wrapper = mount(App, { propsData: { api: gameApi } })

    await enterHub(wrapper)
    await wrapper.get('[data-test="normal-button"]').trigger('click')
    await wrapper.get('[data-test="level-1"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve))

    expect(wrapper.find('[data-test="game-board"]').exists()).toBe(true)
  })

  it('keeps the round mode when rendering a server settlement response', async () => {
    const settlementApi = {
      ...api(),
      settleGame: async () => ({ finalScore: 220, passed: true, coinsAwarded: 40 }),
    }
    const wrapper = mount(App, { propsData: { api: settlementApi } })
    wrapper.vm.currentMode = 'normal'

    await wrapper.vm.finishGame({ mode: 'normal', level: 1, fruitHits: [{ fruit: 'apple' }], slicedCount: 1, appearedCount: 1, timeLeft: 0, roundSeconds: 30, elapsedSeconds: 0 })

    expect(wrapper.vm.currentSettlement.mode).toBe('normal')
    expect(wrapper.vm.screen).toBe('settlement')
    expect(wrapper.find('[data-test="settlement-actions"]').exists()).toBe(true)
  })

  it('opens a server-backed shop drawer from the hub navigation', async () => {
    const wrapper = mount(App, { propsData: { api: api() } })
    await enterHub(wrapper)

    await wrapper.get('[data-test="shop-button"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve))

    expect(wrapper.text()).toContain('复活卡')
  })

  it('forces an administrator into the backend instead of the game hub', async () => {
    const adminApi = {
      ...api(),
      login: async () => ({ token: 'admin-token', player: { role: 'admin' } }),
      getPlayerState: async () => ({ player: { username: 'admin', role: 'admin' }, wallet: {}, progress: { normal: { levels: [] }, hard: { levels: [] } } }),
    }
    const wrapper = mount(App, { propsData: { api: adminApi } })

    await wrapper.vm.enterHub({ mode: 'login', username: 'admin', password: 'Admin123', acceptedTerms: true })

    expect(wrapper.get('[data-test="admin-console"]').text()).toContain('运营控制台')
    expect(wrapper.find('[data-test="normal-button"]').exists()).toBe(false)
  })

  it('keeps the selected full admin module in the root page state', async () => {
    const adminApi = {
      ...api(),
      login: async () => ({ token: 'admin-token', player: { role: 'admin' } }),
      getPlayerState: async () => ({ player: { username: 'admin', role: 'admin' }, wallet: {}, progress: { normal: { levels: [] }, hard: { levels: [] } } }),
    }
    const wrapper = mount(App, { propsData: { api: adminApi } })

    await wrapper.vm.enterHub({ mode: 'login', username: 'admin', password: 'Admin123', acceptedTerms: true })
    await wrapper.get('[data-test="admin-nav-users"]').trigger('click')

    expect(wrapper.vm.adminSection).toBe('users')
    expect(wrapper.get('[data-test="admin-nav-users"]').classes()).toContain('active')
  })
})
