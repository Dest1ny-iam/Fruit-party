# Vue 2 Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可运行、可测试的 Vue 2 前端工程，并交付一个包含基础交互的水果切切乐静态首页。

**Architecture:** 使用 Vue 2.7 单文件组件承载页面。`App.vue` 只组织首页内容和一个局部提示状态，`base.css` 只保存全局 CSS Reset、字体和背景，后续路由、登录页和游戏引擎会在独立任务中加入。

**Tech Stack:** Vue 2.7, Vite 5, @vitejs/plugin-vue2, Vitest, Vue Test Utils, HTML5, CSS3

---

## File Structure

```text
fruit-party-web/
├─ package.json              # 前端依赖和 npm 脚本
├─ vite.config.js            # Vue 2 插件和测试运行环境
├─ index.html                # 浏览器入口 HTML
└─ src/
   ├─ main.js                # 挂载 Vue 根组件
   ├─ App.vue                # 静态首页和点击提示
   ├─ App.spec.js            # 首页组件行为测试
   └─ styles/
      └─ base.css            # 全局基础 CSS
```

### Task 1: 建立 Vue 2 构建与测试环境

**Files:**
- Create: `fruit-party-web/package.json`
- Create: `fruit-party-web/vite.config.js`
- Create: `fruit-party-web/index.html`
- Create: `fruit-party-web/src/main.js`
- Create: `fruit-party-web/src/styles/base.css`

- [x] **Step 1: 创建前端目录并编写 `package.json`**

```json
{
  "name": "fruit-party-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "vue": "2.7.16"
  },
  "devDependencies": {
    "@vitejs/plugin-vue2": "2.3.3",
    "@vue/test-utils": "1.3.6",
    "jsdom": "25.0.1",
    "vite": "5.4.14",
    "vitest": "2.1.8"
  }
}
```

- [x] **Step 2: 安装依赖**

Run: `npm install`

Expected: 命令以退出码 0 结束，并创建 `node_modules` 和 `package-lock.json`。

- [x] **Step 3: 编写 Vite 配置**

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue2'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [x] **Step 4: 编写浏览器入口和 Vue 挂载文件**

`fruit-party-web/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="水果切切乐网页小游戏" />
    <title>水果切切乐</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

`fruit-party-web/src/main.js`:

```js
import Vue from 'vue'
import App from './App.vue'
import './styles/base.css'

new Vue({
  render: (createElement) => createElement(App),
}).$mount('#app')
```

- [x] **Step 5: 编写全局基础样式**

```css
:root {
  font-family: Arial, "Microsoft YaHei", sans-serif;
  color: #172033;
  background: #e8f7ff;
}

* {
  box-sizing: border-box;
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
}

button,
input {
  font: inherit;
}

button {
  cursor: pointer;
}
```

- [x] **Step 6: 验证空入口在缺少根组件时失败**

Run: `npm run build`

Expected: FAIL，错误信息包含无法解析 `src/App.vue`。这个失败说明构建命令真实读取了入口文件。

### Task 2: 测试驱动实现静态首页

**Files:**
- Create: `fruit-party-web/src/App.spec.js`
- Create: `fruit-party-web/src/App.vue`

- [x] **Step 1: 先写首页行为测试**

```js
import { mount } from '@vue/test-utils'
import App from './App.vue'

describe('App', () => {
  it('显示游戏标题和开始按钮', () => {
    const wrapper = mount(App)

    expect(wrapper.get('h1').text()).toBe('水果切切乐')
    expect(wrapper.get('button').text()).toBe('开始挑战')
  })

  it('点击开始按钮后显示准备提示', async () => {
    const wrapper = mount(App)

    await wrapper.get('button').trigger('click')

    expect(wrapper.text()).toContain('游戏大厅将在下一阶段完成')
  })
})
```

- [x] **Step 2: 运行测试，确认它因根组件不存在而失败**

Run: `npm test`

Expected: FAIL，错误信息包含 `Failed to resolve import "./App.vue"`。

- [x] **Step 3: 编写最小可用的首页组件**

```vue
<template>
  <main class="home-page">
    <header class="brand">
      <p class="eyebrow">FRUIT PARTY</p>
      <h1>水果切切乐</h1>
      <p class="subtitle">切开水果，闯过五关，解锁无尽挑战。</p>
    </header>

    <section class="challenge-panel" aria-labelledby="first-challenge-title">
      <p class="stage-label">第一站</p>
      <h2 id="first-challenge-title">准备你的第一场挑战</h2>
      <p>完成账号登录后，你将从第一关开始训练鼠标切割。</p>
      <button type="button" @click="showMessage = true">开始挑战</button>
      <p v-if="showMessage" class="notice" role="status">
        游戏大厅将在下一阶段完成。
      </p>
    </section>
  </main>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      showMessage: false,
    }
  },
}
</script>

<style scoped>
.home-page {
  display: grid;
  place-items: center;
  gap: 32px;
  min-height: 100vh;
  padding: 40px 24px;
  text-align: center;
}

.brand {
  max-width: 620px;
}

.eyebrow,
.stage-label {
  margin: 0;
  color: #0c7f7b;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 12px;
  font-size: 48px;
}

.subtitle {
  margin-bottom: 0;
  font-size: 18px;
}

.challenge-panel {
  width: min(100%, 520px);
  padding: 28px;
  border: 2px solid #172033;
  border-radius: 8px;
  background: #ffffff;
}

h2 {
  margin-bottom: 12px;
  font-size: 24px;
}

.challenge-panel button {
  min-width: 140px;
  min-height: 44px;
  border: 0;
  border-radius: 6px;
  background: #f55f4e;
  color: #ffffff;
  font-weight: 700;
}

.challenge-panel button:hover {
  background: #d9473b;
}

.notice {
  margin: 18px 0 0;
  color: #0c7f7b;
  font-weight: 700;
}
</style>
```

- [x] **Step 4: 运行组件测试**

Run: `npm test`

Expected: PASS，输出显示 2 个测试通过。

- [x] **Step 5: 构建生产文件**

Run: `npm run build`

Expected: PASS，输出包含 `dist/index.html` 和已转换的模块。

- [ ] **Step 6: 在浏览器人工验证**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite 输出本地 URL。打开后确认标题、说明、按钮显示正常，点击“开始挑战”后出现准备提示。

- [ ] **Step 7: 提交该阶段**

```powershell
git add fruit-party-web
git commit -m "feat: add Vue 2 frontend foundation"
```

Expected: Git 创建一个只包含前端初始化和静态首页的提交。

## Phase Completion Checklist

- [ ] 能解释 `index.html`、`main.js` 与 `App.vue` 的加载顺序。
- [ ] 能区分 `template`、`script` 与 `style scoped` 的职责。
- [ ] 能解释 `data()` 为什么返回一个对象，而不是将 `showMessage` 写在组件外部。
- [ ] 能独立把“第一站”改成任意文案，并确认页面更新。
- [ ] `npm test` 和 `npm run build` 都通过。
- [ ] 静态首页在桌面浏览器中可见、按钮可用。
