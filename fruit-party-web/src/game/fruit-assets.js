export const FRUIT_VARIANTS = Object.freeze(['whole', 'halfA', 'halfB'])

export const FRUIT_ASSETS = Object.freeze({
  watermelon: Object.freeze({ directory: '西瓜', displayName: '西瓜' }),
  apple: Object.freeze({ directory: '苹果', displayName: '苹果' }),
  orange: Object.freeze({ directory: '橙子', displayName: '橙子' }),
  kiwi: Object.freeze({ directory: '猕猴桃', displayName: '猕猴桃' }),
  mango: Object.freeze({ directory: '芒果', displayName: '芒果' }),
  lemon: Object.freeze({ directory: '柠檬', displayName: '柠檬' }),
})

export const FRUIT_IDS = Object.freeze(Object.keys(FRUIT_ASSETS))

function normalizedBaseUrl(assetBaseUrl) {
  return String(assetBaseUrl || '/models').replace(/\/$/, '')
}

export function getFruitModelPath(fruit, variant, { assetBaseUrl = '/models' } = {}) {
  const asset = FRUIT_ASSETS[fruit]
  if (!asset || !FRUIT_VARIANTS.includes(variant)) throw new Error(`Unknown fruit asset: ${fruit}/${variant}`)
  return `${normalizedBaseUrl(assetBaseUrl)}/${asset.directory}/${variant}.glb`
}

export function listFruitModelPaths({ assetBaseUrl = '/models', fruits = FRUIT_IDS } = {}) {
  return fruits.flatMap((fruit) => FRUIT_VARIANTS.map((variant) => getFruitModelPath(fruit, variant, { assetBaseUrl })))
}
