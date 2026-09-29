import { describe, expect, it, vi } from 'vitest'
import { prepareAvatarImage } from './avatar-image'

describe('头像图片处理', () => {
  it('把横向照片居中裁切并压缩成 256 像素头像', async () => {
    const drawImage = vi.fn()
    const bitmap = { width: 400, height: 200, close: vi.fn() }
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,compressed-avatar'),
    }
    const file = { type: 'image/jpeg', size: 2_000_000 }

    const result = await prepareAvatarImage(file, {
      createBitmap: vi.fn().mockResolvedValue(bitmap),
      createCanvas: () => canvas,
    })

    expect(result).toBe('data:image/jpeg;base64,compressed-avatar')
    expect(canvas.width).toBe(256)
    expect(canvas.height).toBe(256)
    expect(drawImage).toHaveBeenCalledWith(bitmap, 100, 0, 200, 200, 0, 0, 256, 256)
    expect(bitmap.close).toHaveBeenCalled()
  })

  it('拒绝非图片和超过 10MB 的原图', async () => {
    await expect(prepareAvatarImage({ type: 'text/plain', size: 10 })).rejects.toThrow('请选择图片文件')
    await expect(prepareAvatarImage({ type: 'image/jpeg', size: 11 * 1024 * 1024 })).rejects.toThrow('不能超过 10MB')
  })
})
