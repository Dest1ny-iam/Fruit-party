# Vue 2 Auth and Game Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将静态首页替换为黑暗幽蓝风的登录/注册入口，并在假登录后展示包含闯关和锁定无尽模式的游戏大厅。

**Architecture:** `App.vue` 只保存顶层页面状态和假玩家数据。`AuthPanel.vue` 处理登录/注册标签与假登录事件；`GameHub.vue` 处理大厅布局与模式入口；`LevelSelector.vue` 显示关卡锁定状态。真实账户、路由和后端接口后续替换假数据。

**Tech Stack:** Vue 2.7 Options API, Vue Test Utils, Vitest, HTML5, CSS3

---

## File Structure

```text
fruit-party-web/src/
├─ App.vue                         # 认证页 / 大厅 / 关卡选择的顶层状态
├─ App.spec.js                     # 用户流程测试
├─ data/level-data.js              # 五关固定展示数据
├─ components/AuthPanel.vue        # 登录、注册标签和假登录按钮
├─ components/GameHub.vue          # 幽蓝大厅、头像入口和模式卡片
├─ components/LevelSelector.vue    # 五个关卡的可用与锁定状态
└─ styles/base.css                 # 深蓝全局背景与基础样式
```

### Task 1: 用假登录替换静态欢迎页

**Files:**
- Create: `fruit-party-web/src/components/AuthPanel.vue`
- Modify: `fruit-party-web/src/App.vue`
- Modify: `fruit-party-web/src/App.spec.js`
- Test: `fruit-party-web/src/App.spec.js`

- [x] **Step 1: 写出失败测试**

```js
it('收到假登录事件后显示游戏大厅', async () => {
  const wrapper = mount(App)

  await wrapper.get('[data-test="enter-hub"]').trigger('click')

  expect(wrapper.text()).toContain('游戏大厅')
})
```

- [x] **Step 2: 运行测试确认失败**

Run: `npm test`

Expected: FAIL，因为当前组件没有 `data-test="enter-hub"` 的按钮。

- [x] **Step 3: 实现最小认证组件和顶层状态**

`AuthPanel.vue` 初始显示登录标签；点击注册标签后显示注册状态；“进入游戏大厅”按钮触发 `this.$emit('enter')`，并带有 `data-test="enter-hub"`。

`App.vue` 使用 `screen: 'auth'` 作为初始状态。收到 `enter` 事件后改为 `screen: 'hub'`，并以 `v-if` 显示认证组件或大厅占位标题。

- [x] **Step 4: 运行测试确认通过**

Run: `npm test`

Expected: PASS。

### Task 2: 添加黑暗幽蓝风游戏大厅

**Files:**
- Create: `fruit-party-web/src/components/GameHub.vue`
- Modify: `fruit-party-web/src/App.vue`
- Modify: `fruit-party-web/src/App.spec.js`
- Modify: `fruit-party-web/src/styles/base.css`
- Test: `fruit-party-web/src/App.spec.js`

- [ ] **Step 1: 写出大厅锁定状态测试**

```js
it('假登录后显示闯关入口和锁定的无尽入口', async () => {
  const wrapper = mount(App)

  await wrapper.get('[data-test="enter-hub"]').trigger('click')

  expect(wrapper.text()).toContain('闯关挑战')
  expect(wrapper.text()).toContain('无尽挑战')
  expect(wrapper.get('[data-test="endless-lock"]').text()).toBe('锁定')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`

Expected: FAIL，因为大厅还没有无尽模式锁定标记。

- [ ] **Step 3: 实现大厅组件**

`GameHub.vue` 渲染：左侧头像按钮、玩家名“水果新手”、个人主页入口文字、进度 `0 / 5`；右侧“选择挑战”、闯关挑战按钮和禁用的无尽挑战按钮。无尽按钮右下角带 `data-test="endless-lock"` 且文本为“锁定”。水果背景图形只作为低透明度装饰。

`App.vue` 在 `screen === 'hub'` 时渲染 `<GameHub />`。

- [ ] **Step 4: 运行测试和生产构建**

Run: `npm test && npm run build`

Expected: PASS；全部测试通过，Vite 生成 `dist`。

### Task 3: 显示按顺序锁定的五关

**Files:**
- Create: `fruit-party-web/src/data/level-data.js`
- Create: `fruit-party-web/src/components/LevelSelector.vue`
- Modify: `fruit-party-web/src/components/GameHub.vue`
- Modify: `fruit-party-web/src/App.vue`
- Modify: `fruit-party-web/src/App.spec.js`
- Test: `fruit-party-web/src/App.spec.js`

- [ ] **Step 1: 写出失败测试**

```js
it('进入闯关挑战后只让第一关可选', async () => {
  const wrapper = mount(App)

  await wrapper.get('[data-test="enter-hub"]').trigger('click')
  await wrapper.get('[data-test="campaign-button"]').trigger('click')

  expect(wrapper.get('[data-test="level-1"]').attributes('disabled')).toBeUndefined()
  expect(wrapper.get('[data-test="level-2"]').attributes('disabled')).toBeDefined()
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`

Expected: FAIL，因为闯关按钮尚未切换到关卡选择组件。

- [ ] **Step 3: 实现固定关卡数据和选择组件**

`level-data.js` 导出 5 个对象，每个对象含 `number` 与 `targetScore`。`LevelSelector.vue` 接收 `highestLevel`；数字大于 `highestLevel` 的关卡按钮带有 `disabled` 属性。`GameHub.vue` 在闯关按钮点击时发出 `select-campaign`，`App.vue` 将页面状态改为 `levels`。

- [ ] **Step 4: 运行测试和生产构建**

Run: `npm test && npm run build`

Expected: PASS；第 1 关可用，第 2 至第 5 关锁定，生产构建成功。

### Task 4: 人工验证与阶段提交

**Files:**
- Modify: `docs/superpowers/specs/2026-09-09-fruit-party-design.md`
- Modify: `docs/superpowers/plans/2026-09-09-vue2-auth-hub.md`

- [ ] **Step 1: 人工验证**

Run: `npm run dev -- --host 127.0.0.1`

Expected: 初始显示登录/注册表单；点击进入大厅后显示幽蓝大厅；点击闯关挑战后显示关卡选择；无尽挑战维持锁定状态。

- [ ] **Step 2: 全量验证**

Run: `git diff --check && npm test && npm run build`

Expected: 没有空白字符错误；测试与生产构建均成功。

- [ ] **Step 3: 提交功能分支**

```powershell
git add fruit-party-web docs/superpowers/specs/2026-09-09-fruit-party-design.md docs/superpowers/plans/2026-09-09-vue2-auth-hub.md
git commit -m "feat: add fake login and game hub"
```

Expected: `feature/vue2-foundation` 出现独立提交，尚未合并到 `master`。

## Coverage Review

- 登录/注册第一层和假数据进入大厅：Task 1
- 黑暗幽蓝视觉、左侧头像与水果背景、右侧模式入口：Task 2
- 仅第 1 关初始可选、顺序锁定：Task 3
- 第 5 关后解锁无尽模式：真实通关逻辑在游戏阶段接入；本阶段准确展示初始锁定状态
