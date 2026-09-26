# First Iteration Real Data and 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace client-side player and gameplay placeholder data with persistent server data, and add a 3D fruit resource layer without changing game rule ownership.

**Architecture:** An Express service owns SQLite persistence, session tokens, authoritative game settlement, and server-sent state notifications. Vue consumes an API client and a small state store rather than imported fixture data. A Three.js `FruitAssetManager` owns GLB loading, caching, scene spawning, splitting, and short-lived physics fragments.

**Tech Stack:** Vue 2, Vite, Vitest, Express, better-sqlite3, bcryptjs, jsonwebtoken, Three.js.

---

### Task 1: Persistent API foundation

**Files:**
- Create: `fruit-party-web/server/app.js`
- Create: `fruit-party-web/server/database.js`
- Create: `fruit-party-web/server/schema.sql`
- Create: `fruit-party-web/server/app.spec.js`

- [ ] Write red tests for health, seeded test/admin accounts, and state retrieval without frontend fixtures.
- [ ] Implement schema migrations and deterministic development seed data.
- [ ] Implement an async HTTP application with consistent `{ data, error }` responses.
- [ ] Run `npm test -- server/app.spec.js` and commit the API foundation.

### Task 2: Identity, player state, and realtime updates

**Files:**
- Create: `fruit-party-web/server/auth.js`
- Create: `fruit-party-web/server/realtime.js`
- Create: `fruit-party-web/src/services/api.js`
- Create: `fruit-party-web/src/services/player-store.js`
- Modify: `fruit-party-web/src/App.vue`
- Test: `fruit-party-web/server/app.spec.js`

- [ ] Write red tests for password policy, immutable username conflicts, login, and a player update event.
- [ ] Implement JWT authentication, password hashing, immutable usernames, and SSE fan-out.
- [ ] Add API client/store initialization so the current player and highest unlocked level come from the server.
- [ ] Run API and Vue tests; commit player synchronization.

### Task 3: Progress, rankings, and authoritative settlement

**Files:**
- Create: `fruit-party-web/server/scoring.js`
- Create: `fruit-party-web/server/scoring.spec.js`
- Modify: `fruit-party-web/server/app.js`
- Modify: `fruit-party-web/src/components/GameHub.vue`
- Modify: `fruit-party-web/src/components/LeaderboardPanel.vue`

- [ ] Write red tests for fruit score aggregation, poor precision penalties, time contribution caps, and level unlock only after a passed settlement.
- [ ] Implement a bounded scoring model and transactionally persist attempts, best scores, levels, balances, and leaderboard snapshots.
- [ ] Replace lobby fixture imports with API results and realtime refreshes.
- [ ] Run all tests; commit settlement and ranking integration.

### Task 4: 3D fruit assets and game-facing API

**Files:**
- Create: `fruit-party-web/src/game/FruitAssetManager.js`
- Create: `fruit-party-web/src/game/FruitAssetManager.spec.js`
- Create: `fruit-party-web/src/game/FruitScene.vue`
- Modify: `fruit-party-web/package.json`

- [ ] Write red unit tests for preloading, model cache reuse, whole-fruit spawning, and split-fragment physics setup.
- [ ] Add Three.js and implement the manager around `GLTFLoader` with the required `public/models/<fruit>/{whole,halfA,halfB}.glb` layout.
- [ ] Add a focused 3D scene call-site demonstrating `preload`, `spawnFruit`, `cutFruit`, and frame updates, without moving scoring/game-rule logic into the manager.
- [ ] Run all tests and production build; commit 3D support.

### Task 5: Frontend cleanup and acceptance checks

**Files:**
- Modify: `fruit-party-web/src/data/lobby-data.js`
- Modify: `fruit-party-web/src/data/level-data.js`
- Modify: `fruit-party-web/src/components/AuthPanel.vue`
- Modify: `fruit-party-web/README.md`

- [ ] Write red assertions that no production component imports player or level fixture data and that a renamed username is rejected with a styled message.
- [ ] Remove production fixture usage, route visible auth errors through the API, and document local server startup and GLB placement.
- [ ] Run unit tests, API tests, Vite build, and a two-client SSE smoke test.
- [ ] Commit the completed iteration on `codex/iteration-one`.
