import { mount } from '@vue/test-utils'
import { vi } from 'vitest'
import ProfilePage from './ProfilePage.vue'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('ProfilePage', () => {
  it('展示玩家资料、资源和两种模式进度', async () => {
    const wrapper = mount(ProfilePage, {
      propsData: {
        username: '切水果的新手',
        avatar: '🍉',
        coins: 240,
        energy: 3,
        highestLevel: 2,
        highestHardLevel: 1,
        coinLedger: [{ amount: -320, title: '购买复活卡', occurredAt: '今天 14:32' }],
      },
    })

    expect(wrapper.get('[data-test="profile-name"]').text()).toBe('切水果的新手')
    expect(wrapper.get('[data-test="profile-coins"]').text()).toContain('240')
    expect(wrapper.get('[data-test="normal-progress"]').text()).toContain('第 2 关')
    expect(wrapper.get('[data-test="normal-progress"]').text()).toContain('2/10')
    expect(wrapper.get('[data-test="normal-progress"] .progress-track span').attributes('style')).toContain('20%')
    expect(wrapper.get('[data-test="hard-progress"]').text()).toContain('第 1 关')
    expect(wrapper.get('[data-test="hard-progress"]').text()).toContain('1/10')
    expect(wrapper.get('[data-test="profile-activity"]').text()).toContain('购买复活卡')

    await wrapper.get('[data-test="open-avatar-picker"]').trigger('click')
    await wrapper.get('[data-test="avatar-option-🍓"]').trigger('click')
    expect(wrapper.emitted('avatar-change')).toEqual([['🍓']])

    await wrapper.get('[data-test="back-from-profile"]').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('保留预设头像并支持从电脑文件或手机相册选择本地图片', async () => {
    const avatarDataUrl = 'data:image/jpeg;base64,compressed-avatar'
    const avatarProcessor = vi.fn().mockResolvedValue(avatarDataUrl)
    const wrapper = mount(ProfilePage, { propsData: { avatarProcessor } })

    await wrapper.get('[data-test="open-avatar-picker"]').trigger('click')
    expect(wrapper.get('[data-test="avatar-option-🍉"]').exists()).toBe(true)

    const input = wrapper.get('[data-test="local-avatar-input"]')
    expect(input.attributes('accept')).toBe('image/*')
    const imageFile = new File(['avatar'], 'my-avatar.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input.element, 'files', { configurable: true, value: [imageFile] })
    await input.trigger('change')
    await flushPromises()

    expect(avatarProcessor).toHaveBeenCalledWith(imageFile)
    expect(wrapper.emitted('avatar-change')).toEqual([[avatarDataUrl]])
  })

  it('允许玩家在主页修改用户名，并能主动退出登录', async () => {
    const wrapper = mount(ProfilePage, { propsData: { username: '水果新手' } })

    await wrapper.get('[data-test="open-username-editor"]').trigger('click')
    await wrapper.get('[data-test="username-input"]').setValue('切水果达人')
    await wrapper.get('[data-test="username-form"]').trigger('submit.prevent')

    expect(wrapper.emitted('username-change')).toEqual([['切水果达人']])

    await wrapper.get('[data-test="logout-player"]').trigger('click')
    expect(wrapper.emitted('logout')).toHaveLength(1)
  })

  it('用紧凑的玩家名片展示资源、近期动态和关卡进度', () => {
    const wrapper = mount(ProfilePage, {
      propsData: {
        username: '切水果达人',
        coins: 360,
        energy: 4,
        highestLevel: 3,
        highestHardLevel: 2,
        coinLedger: [
          { amount: 120, title: '普通模式结算奖励', occurredAt: '刚刚' },
          { amount: -180, title: '购买延时道具', occurredAt: '昨天' },
        ],
      },
    })

    expect(wrapper.get('[data-test="profile-summary"]').text()).toContain('切水果达人')
    expect(wrapper.get('[data-test="profile-resources"]').text()).toContain('360')
    expect(wrapper.get('[data-test="profile-activity-title"]').text()).toBe('最近动态')
    expect(wrapper.get('[data-test="profile-activity"]').text()).toContain('购买延时道具')
    expect(wrapper.text()).not.toContain('最近 50 条记录')
  })
})
