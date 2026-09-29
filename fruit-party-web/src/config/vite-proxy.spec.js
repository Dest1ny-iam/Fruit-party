import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Vite 开发代理', () => {
  it('将 API 请求转发给本地后端', () => {
    const source = readFileSync('vite.config.js', 'utf8')

    expect(source).toContain("'/api'")
    expect(source).toContain('http://127.0.0.1:3000')
  })
})
