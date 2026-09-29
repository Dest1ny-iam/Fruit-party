import { beforeEach, describe, expect, it } from 'vitest'
import {
  createDemoRechargeOrder,
  getDemoRechargeOrder,
  listAllDemoRechargeProducts,
  listDemoRechargeProducts,
  RECHARGE_ORDER_TTL_MS,
  saveDemoRechargeProduct,
} from './recharge-store'

describe('充值商品与订单本地异步仓库', () => {
  beforeEach(() => window.localStorage.clear())

  it('默认提供金币和永久免能量两种启用商品', async () => {
    const products = await listDemoRechargeProducts()

    expect(products).toHaveLength(2)
    expect(products.map((item) => item.benefitType)).toEqual(['coins', 'permanent-free-entry'])
    expect(products[0]).toMatchObject({ price: 1, benefitAmount: 1000, enabled: true })
  })

  it('创建订单时冻结商品快照并固定十分钟过期时间', async () => {
    const now = new Date('2026-09-21T12:00:00+08:00').valueOf()
    const order = await createDemoRechargeOrder('coins-1000', window.localStorage, now)

    expect(order.expiresAt).toBe(now + RECHARGE_ORDER_TTL_MS)
    expect(order.status).toBe('pending')
    expect(order.productSnapshot).toMatchObject({ id: 'coins-1000', price: 1, benefitAmount: 1000 })
  })

  it('刷新读取沿用原过期时间，过期后只更新状态而不延长订单', async () => {
    const now = 1_800_000_000_000
    const created = await createDemoRechargeOrder('coins-1000', window.localStorage, now)

    const restored = await getDemoRechargeOrder(created.id, window.localStorage, now + 60_000)
    expect(restored.expiresAt).toBe(created.expiresAt)
    expect(restored.status).toBe('pending')

    const expired = await getDemoRechargeOrder(created.id, window.localStorage, created.expiresAt + 1)
    expect(expired.expiresAt).toBe(created.expiresAt)
    expect(expired.status).toBe('expired')
  })

  it('不存在或已停用的商品不能创建订单', async () => {
    await expect(createDemoRechargeOrder('missing')).rejects.toThrow('充值商品不可用')
  })

  it('管理员保存启用商品后玩家列表立即按顺序读取到新卡片', async () => {
    await saveDemoRechargeProduct({
      name: '3000 金币', price: 3, benefitType: 'coins', benefitAmount: 3000,
      description: '测试新增商品', enabled: true, sortOrder: 5,
      qrCodeImage: 'data:image/png;base64,qr',
    })

    const playerProducts = await listDemoRechargeProducts()
    const adminProducts = await listAllDemoRechargeProducts()
    expect(playerProducts[0]).toMatchObject({ name: '3000 金币', price: 3 })
    expect(adminProducts).toHaveLength(3)
  })

  it('启用商品没有二维码时拒绝保存', async () => {
    await expect(saveDemoRechargeProduct({
      name: '缺少二维码', price: 2, benefitType: 'coins', benefitAmount: 100,
      enabled: true, sortOrder: 30, qrCodeImage: '',
    })).rejects.toThrow('请先上传收款二维码')
  })

  it('支持能量、道具和自定义充值权益', async () => {
    const product = await saveDemoRechargeProduct({
      name: '自定义礼包', price: 8, benefitType: 'custom', benefitAmount: 2,
      benefitName: '周末特权', description: '演示权益', enabled: false, sortOrder: 30,
    })

    expect(product).toMatchObject({ benefitType: 'custom', benefitAmount: 2, benefitName: '周末特权' })
  })
})
