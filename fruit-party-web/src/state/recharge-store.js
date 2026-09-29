const PRODUCTS_STORAGE_KEY = 'fruit-party.recharge-products'
const ORDERS_STORAGE_KEY = 'fruit-party.recharge-orders'

export const RECHARGE_ORDER_TTL_MS = 10 * 60 * 1000

// 本地演示阶段使用明确标注的占位图；真实收款码必须由管理员上传。
const DEMO_QR_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"%3E%3Crect width="320" height="320" fill="%23fff"/%3E%3Cg fill="%23101824"%3E%3Cpath d="M30 30h90v90H30zm20 20v50h50V50zM200 30h90v90h-90zm20 20v50h50V50zM30 200h90v90H30zm20 20v50h50v-50z"/%3E%3Cpath d="M145 35h25v25h-25zm0 45h25v55h-25zm35 65h30v30h-30zm45 0h25v25h-25zm45 0h20v55h-20zm-125 50h25v25h-25zm45 0h55v25h-55zm-45 45h25v50h-25zm45 0h25v25h-25zm45 0h55v50h-55z"/%3E%3C/g%3E%3Ctext x="160" y="182" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="%23b4232c"%3EDEMO%3C/text%3E%3C/svg%3E'

export const DEFAULT_RECHARGE_PRODUCTS = Object.freeze([
  Object.freeze({
    id: 'coins-1000',
    name: '1000 金币',
    price: 1,
    benefitType: 'coins',
    benefitAmount: 1000,
    description: '支付确认后由服务端发放 1000 金币',
    enabled: true,
    sortOrder: 10,
    qrCodeImage: DEMO_QR_IMAGE,
  }),
  Object.freeze({
    id: 'permanent-free-entry',
    name: '永久免能量开局',
    price: 1,
    benefitType: 'permanent-free-entry',
    benefitAmount: 1,
    description: '支付确认后进入游戏永久不再消耗能量',
    enabled: true,
    sortOrder: 20,
    qrCodeImage: DEMO_QR_IMAGE,
  }),
])

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function readCollection(storage, key, fallback) {
  try {
    const saved = JSON.parse(storage.getItem(key) || 'null')
    return Array.isArray(saved) ? saved : clone(fallback)
  } catch {
    return clone(fallback)
  }
}

function writeCollection(storage, key, value) {
  storage.setItem(key, JSON.stringify(value))
}

export async function listDemoRechargeProducts(storage = window.localStorage) {
  return readCollection(storage, PRODUCTS_STORAGE_KEY, DEFAULT_RECHARGE_PRODUCTS)
    .filter((product) => product.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(clone)
}

export async function listAllDemoRechargeProducts(storage = window.localStorage) {
  return readCollection(storage, PRODUCTS_STORAGE_KEY, DEFAULT_RECHARGE_PRODUCTS)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(clone)
}

export async function saveDemoRechargeProduct(product, storage = window.localStorage) {
  const normalized = {
    ...clone(product),
    id: product.id || `recharge-product-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: String(product.name || '').trim(),
    price: Math.max(0.01, Number(product.price) || 0.01),
    benefitAmount: Math.max(1, Math.round(Number(product.benefitAmount) || 1)),
    benefitName: String(product.benefitName || '').trim(),
    description: String(product.description || '').trim(),
    enabled: product.enabled !== false,
    sortOrder: Math.round(Number(product.sortOrder) || 0),
    qrCodeImage: String(product.qrCodeImage || ''),
  }
  if (!normalized.name) throw new Error('请输入商品名称')
  if (!['coins', 'energy', 'item', 'permanent-free-entry', 'custom'].includes(normalized.benefitType)) throw new Error('请选择权益类型')
  if (['item', 'custom'].includes(normalized.benefitType) && !normalized.benefitName) throw new Error('请输入权益名称或标识')
  if (normalized.enabled && !normalized.qrCodeImage) throw new Error('请先上传收款二维码')

  const products = await listAllDemoRechargeProducts(storage)
  const index = products.findIndex((item) => item.id === normalized.id)
  if (index >= 0) products[index] = normalized
  else products.push(normalized)
  writeCollection(storage, PRODUCTS_STORAGE_KEY, products)
  return clone(normalized)
}

export async function createDemoRechargeOrder(productId, storage = window.localStorage, now = Date.now()) {
  const product = (await listDemoRechargeProducts(storage)).find((item) => item.id === productId)
  if (!product) throw new Error('充值商品不可用')

  const uniquePart = globalThis.crypto?.randomUUID?.() || `${now}-${Math.random().toString(36).slice(2, 9)}`
  const order = {
    id: `recharge-${uniquePart}`,
    productId: product.id,
    productSnapshot: clone(product),
    createdAt: now,
    expiresAt: now + RECHARGE_ORDER_TTL_MS,
    status: 'pending',
  }
  const orders = readCollection(storage, ORDERS_STORAGE_KEY, [])
  orders.push(order)
  writeCollection(storage, ORDERS_STORAGE_KEY, orders)
  return clone(order)
}

export async function getDemoRechargeOrder(orderId, storage = window.localStorage, now = Date.now()) {
  const orders = readCollection(storage, ORDERS_STORAGE_KEY, [])
  const index = orders.findIndex((item) => item.id === orderId)
  if (index < 0) return null

  if (orders[index].status === 'pending' && now >= orders[index].expiresAt) {
    orders[index] = { ...orders[index], status: 'expired' }
    writeCollection(storage, ORDERS_STORAGE_KEY, orders)
  }
  return clone(orders[index])
}

export { ORDERS_STORAGE_KEY, PRODUCTS_STORAGE_KEY }
