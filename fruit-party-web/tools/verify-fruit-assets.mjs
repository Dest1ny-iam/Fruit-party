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

export async function verifyFruitAssetRequirement({ modelsDirectory, requireGlbAssets = false } = {}) {
  const result = await validateFruitAssets({ modelsDirectory })
  return { ...result, valid: requireGlbAssets ? result.valid : true, requireGlbAssets }
}

async function main() {
  const result = await verifyFruitAssetRequirement({ requireGlbAssets: process.env.REQUIRE_GLTF_ASSETS === '1' })
  if (result.missing.length === 0) {
    console.log(`Fruit assets ready: ${result.expected.length} GLB files.`)
    return
  }

  const output = result.requireGlbAssets ? console.error : console.log
  output(`${result.missing.length} optional GLB files are unavailable; the deployed game uses procedural Three.js fruit models.`)
  for (const asset of result.missing) output(`- ${asset.fruit}/${asset.variant}: ${asset.path}`)
  if (!result.valid) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
