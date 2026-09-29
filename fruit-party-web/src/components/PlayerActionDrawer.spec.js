import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PlayerActionDrawer from './PlayerActionDrawer.vue'

describe('PlayerActionDrawer', () => {
  it('loads shop records from its API and sends the selected item purchase back to that API', async () => {
    const api = {
      getShopItems: vi.fn().mockResolvedValue([{ id: 7, displayName: '复活卡', description: '继续挑战。', priceCoins: 120, maxPurchaseQuantity: 99 }]),
      purchaseItem: vi.fn().mockResolvedValue({ remainingCoins: 880 }),
    }
    const wrapper = mount(PlayerActionDrawer, { propsData: { panel: 'shop', api } })
    await new Promise((resolve) => setTimeout(resolve))

    expect(wrapper.text()).toContain('复活卡')
    await wrapper.get('[data-test="buy-item-7"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve))
    expect(api.purchaseItem).toHaveBeenCalledWith(expect.objectContaining({ itemId: 7, quantity: 1 }))
    expect(wrapper.emitted('wallet-changed')).toHaveLength(1)
  })

  it('shows all inventory items and supports direct use or next-round selection', async () => {
    const api = {
      getInventory: vi.fn().mockResolvedValue([
        { itemId: 1, itemKey: 'energy-pack', displayName: '能量', description: '恢复 1 格能量', quantity: 2 },
        { itemId: 2, itemKey: 'score-boost', displayName: '分数 ×1.2', description: '提高得分', quantity: 1 },
      ]),
      useInventoryItem: vi.fn().mockResolvedValue({ itemKey: 'energy-pack', quantity: 1, energy: 4 }),
    }
    const wrapper = mount(PlayerActionDrawer, {
      propsData: { panel: 'inventory', api, selectedGameItems: [] },
    })
    await new Promise((resolve) => setTimeout(resolve))

    expect(wrapper.text()).toContain('能量')
    expect(wrapper.text()).toContain('分数 ×1.2')
    expect(wrapper.get('[data-test="inventory-count-energy-pack"]').text()).toContain('2')

    await wrapper.get('[data-test="use-item-energy-pack"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve))
    expect(api.useInventoryItem).toHaveBeenCalledWith('energy-pack')
    expect(wrapper.emitted('wallet-changed')).toHaveLength(1)

    await wrapper.get('[data-test="select-item-score-boost"]').trigger('click')
    expect(wrapper.emitted('game-item-toggle')).toEqual([['score-boost']])
  })
})
