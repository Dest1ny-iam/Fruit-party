import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { validateFruitAssets } from '../../tools/verify-fruit-assets.mjs'

const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('validateFruitAssets', () => {
  it('reports every runtime GLB when the models directory is empty', async () => {
    const modelsDirectory = await mkdtemp(join(tmpdir(), 'fruit-assets-'))
    temporaryDirectories.push(modelsDirectory)

    const result = await validateFruitAssets({ modelsDirectory })

    expect(result.expected).toHaveLength(18)
    expect(result.missing).toHaveLength(18)
    expect(result.missing.slice(0, 3).map(({ fruit, variant }) => `${fruit}/${variant}`)).toEqual([
      'watermelon/whole',
      'watermelon/halfA',
      'watermelon/halfB',
    ])
    expect(result.valid).toBe(false)
  })
})
