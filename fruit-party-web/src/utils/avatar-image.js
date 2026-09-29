const MAX_SOURCE_BYTES = 10 * 1024 * 1024
const AVATAR_SIZE = 256

// 浏览器端先把相册原图裁成正方形并压缩，避免把几 MB 的照片直接写入会话。
// 正式后端接入后可以继续复用这个结果上传对象存储，数据库只保存返回的 URL。
export async function prepareAvatarImage(file, dependencies = {}) {
  if (!file?.type?.startsWith('image/')) throw new Error('请选择图片文件。')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('头像原图不能超过 10MB。')

  const createBitmap = dependencies.createBitmap || window.createImageBitmap.bind(window)
  const createCanvas = dependencies.createCanvas || (() => document.createElement('canvas'))
  const bitmap = await createBitmap(file)
  const sourceSize = Math.min(bitmap.width, bitmap.height)
  const sourceX = Math.round((bitmap.width - sourceSize) / 2)
  const sourceY = Math.round((bitmap.height - sourceSize) / 2)
  const canvas = createCanvas()
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  const context = canvas.getContext('2d')

  if (!context) {
    bitmap.close?.()
    throw new Error('当前浏览器无法处理头像图片。')
  }

  context.drawImage(bitmap, sourceX, sourceY, sourceSize, sourceSize, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', 0.82)
}

export function isImageAvatar(avatar) {
  return typeof avatar === 'string' && (avatar.startsWith('data:image/') || /^https?:\/\//.test(avatar))
}
