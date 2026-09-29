import { stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FRUIT_ASSETS, FRUIT_IDS, FRUIT_VARIANTS } from '../src/game/fruit-assets.js'

function requiredAssets(modelsDirectory) {
  return FRUIT_IDS.flatMap((fruit) => FRUIT_VARIANTS.map((variant) => ({
    fruit,
    variant,
    path: join(modelsDirectory, FRUIT_ASSETS[fruit].directory, `${variant}.glb`),
  })))
}

async function isNonEmptyFile(path) {
  try {
    const file = await stat(path)
    return file.isFile() && file.size > 0
  } catch {
    return false
  }
}

export async function validateFruitAssets({ modelsDirectory } = {}) {
  const resolvedModelsDirectory = resolve(modelsDirectory || join(dirname(fileURLToPath(import.meta.url)), '../public/models'))
  const expected = requiredAssets(resolvedModelsDirectory)
  const checks = await Promise.all(expected.map(async (asset) => ({
    asset,
    exists: await isNonEmptyFile(asset.path),
  })))
  const missing = checks.filter(({ exists }) => !exists).map(({ asset }) => asset)

  return { expected, missing, valid: missing.length === 0 }
}

async function main() {
  const result = await validateFruitAssets()
  if (result.valid) {
    console.log(`Fruit assets ready: ${result.expected.length} GLB files.`)
    return
  }

  console.error(`Missing ${result.missing.length} of ${result.expected.length} fruit GLB files:`)
  for (const asset of result.missing) console.error(`- ${asset.fruit}/${asset.variant}: ${asset.path}`)
  process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
