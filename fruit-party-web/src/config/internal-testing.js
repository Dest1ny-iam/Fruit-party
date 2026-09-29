export const INTERNAL_TEST_USERNAME = 'tester'
export const INTERNAL_TEST_PASSWORD = 'test123456'

export function isInternalTestingFeatureEnabled(env = import.meta.env) {
  return env.VITE_ENABLE_INTERNAL_TEST_MODE !== 'false'
}

// 演示登录统一从这里解析角色；接入后端后可用接口返回角色替换该函数。
export function resolveDemoRole(username, password, enabled = isInternalTestingFeatureEnabled()) {
  if (username === 'admin' && password === 'admin123456') return 'admin'
  if (enabled && username === INTERNAL_TEST_USERNAME && password === INTERNAL_TEST_PASSWORD) return 'tester'
  return 'player'
}

export function canUseInternalTesting(session, enabled = isInternalTestingFeatureEnabled()) {
  return enabled && session?.role === 'tester'
}
