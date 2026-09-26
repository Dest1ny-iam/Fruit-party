import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export const USERNAME_PATTERN = /^[\u4e00-\u9fa5A-Za-z0-9_]{2,16}$/
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,32}$/

export function hashPassword(password) {
  return bcrypt.hashSync(password, 12)
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compareSync(password, passwordHash)
}

export function validateCredentials({ username, password }) {
  if (!USERNAME_PATTERN.test(username || '')) return '用户名需为 2-16 位中文、字母、数字或下划线'
  if (!PASSWORD_PATTERN.test(password || '')) return '密码需为 8-32 位，且包含大小写字母与数字'
  return null
}

export function issueToken(user, secret) {
  return jwt.sign({ sub: user.id, role: user.role }, secret, { expiresIn: '12h' })
}

export function readToken(token, secret) {
  return jwt.verify(token, secret)
}
