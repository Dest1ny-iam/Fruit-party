const DEFAULT_LIMITS = Object.freeze({
  login: { max: 10, windowMs: 10 * 60 * 1000 },
  adminWrite: { max: 60, windowMs: 60 * 1000 },
})

function normalizeLimit(limit, fallback) {
  const max = Number(limit?.max)
  const windowMs = Number(limit?.windowMs)
  return {
    max: Number.isInteger(max) && max > 0 ? max : fallback.max,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : fallback.windowMs,
  }
}

function requestIdentity(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown-client'
}

export function createRateLimiter({ limit, code, message }) {
  const entries = new Map()
  const normalized = normalizeLimit(limit, DEFAULT_LIMITS.login)

  return (req, res, next) => {
    const now = Date.now()
    const key = requestIdentity(req)
    const existing = entries.get(key)
    const entry = !existing || now >= existing.resetAt
      ? { count: 0, resetAt: now + normalized.windowMs }
      : existing

    if (entry.count >= normalized.max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
      res.set('Retry-After', String(retryAfter))
      return res.status(429).json({ data: null, error: { code, message } })
    }

    entry.count += 1
    entries.set(key, entry)
    return next()
  }
}

export function resolveRateLimits(overrides = {}) {
  return {
    login: normalizeLimit(overrides.login, DEFAULT_LIMITS.login),
    adminWrite: normalizeLimit(overrides.adminWrite, DEFAULT_LIMITS.adminWrite),
  }
}
