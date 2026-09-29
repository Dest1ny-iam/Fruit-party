# MySQL UI Data Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep every current UI screen and interaction unchanged while making MySQL-backed API responses the sole business-data source.

**Architecture:** The Express API owns validation, authorization, aggregation and transactional mutations. `src/services/api.js` is the sole frontend gateway; page components receive API clients through props or import one small adapter. Local storage retains only the JWT and transient UI preferences, never players, inventory, notifications, recharge products, prices, privileges, logs, progress or balances.

**Tech Stack:** Vue 2, Vitest, Express, MySQL2, JWT, Server-Sent Events.

---

### Task 1: Establish the API contract inventory

**Files:**
- Modify: `fruit-party-web/src/services/api.js`
- Modify: `fruit-party-web/src/services/api.spec.js`
- Modify: `fruit-party-web/server/app.js`
- Test: `fruit-party-web/server/app.spec.js`

- [ ] Add typed client methods for administrative dashboard metrics, players, player status, audit logs, item prices, notices, permissions, recharge products and recharge orders.
- [ ] Add corresponding Express routes guarded with `authenticate` and `requireAdmin`; return only `{ data, error }` envelopes.
- [ ] Test unauthenticated, player-role and admin-role requests for every administrative route.
- [ ] Test that malformed identifiers, negative money or quantity, duplicate request ids and invalid state transitions return 4xx errors without writing a row.

### Task 2: Move reads and mutations into MySQL services

**Files:**
- Modify: `fruit-party-web/server/business.js`
- Modify: `fruit-party-web/server/economy.js`
- Modify: `fruit-party-web/server/schema.mysql.sql`
- Test: `fruit-party-web/server/business.mysql.spec.js`
- Test: `fruit-party-web/server/economy.mysql.spec.js`

- [ ] Add query functions for dashboard aggregates, price configuration, audit records, notification publication history and recharge product administration.
- [ ] Use transactions for price updates, privilege grants, status changes, purchases, recharge-order creation and settlement writes; append the corresponding audit record in the same transaction.
- [ ] Ensure disabled users are excluded from leaderboard and permission-search queries, while administrator audit reads remain available.
- [ ] Add indexes for user status/creation time, audit timestamps, notification recipients, game settlements and recharge ordering.

### Task 3: Replace admin page data without changing its UI

**Files:**
- Modify: `fruit-party-web/src/App.vue`
- Modify: `fruit-party-web/src/components/AdminConsole.vue`
- Modify: `fruit-party-web/src/components/AdminConsole.spec.js`
- Modify: `fruit-party-web/src/components/PlayerAuditLog.vue`
- Modify: `fruit-party-web/src/components/PlayerAuditLog.spec.js`

- [ ] Pass the existing API client into the restored admin shell without changing its markup, navigation or styles.
- [ ] Replace `demoUsers`, `ITEM_CATALOG`, dashboard sample values, sample logs and revenue arrays with empty loading state followed by API results.
- [ ] Map real MySQL users into the existing table shape and call the status endpoint for enable/disable actions.
- [ ] Load audit records and revenue aggregation from the API while retaining existing filters, paging, date ranges and chart grouping controls.
- [ ] Add tests showing an empty response renders an empty state, a real API response renders rows, and mutation responses update the already-visible row rather than inventing client data.

### Task 4: Replace permissions, notifications and recharge stores

**Files:**
- Modify: `fruit-party-web/src/components/AdminPermissionCenter.vue`
- Modify: `fruit-party-web/src/components/AdminNotificationPublisher.vue`
- Modify: `fruit-party-web/src/components/AdminRechargeProducts.vue`
- Modify: `fruit-party-web/src/components/PlayerActionDrawer.vue`
- Remove business reads from: `fruit-party-web/src/state/admin-permission-store.js`, `fruit-party-web/src/state/admin-notification-store.js`, `fruit-party-web/src/state/recharge-store.js`, `fruit-party-web/src/state/notification-store.js`
- Test: corresponding component specs

- [ ] Preserve current layouts and replace store calls with API methods.
- [ ] Publish notifications to all active players or explicitly selected recipients, then push recipient updates through SSE.
- [ ] Persist recharge item creation/editing and order expiration in MySQL; QR display expiry is computed from an API-issued `expiresAt` timestamp.
- [ ] Require password confirmation for privilege changes and make all special benefits visible in player state immediately after the server confirms them.

### Task 5: Complete player-side live data integration

**Files:**
- Modify: `fruit-party-web/src/components/GameHub.vue`
- Modify: `fruit-party-web/src/components/ProfilePage.vue`
- Modify: `fruit-party-web/src/components/LeaderboardPanel.vue`
- Modify: `fruit-party-web/src/components/LevelSelector.vue`
- Modify: `fruit-party-web/src/components/GameBoard.vue`
- Modify: `fruit-party-web/src/services/api.js`
- Test: existing component specs and `fruit-party-web/src/App.spec.js`

- [ ] Derive all balances, inventory, unlocks, personal bests, profiles and leaderboards from `/api/me/state` and associated API endpoints.
- [ ] Keep tester privileges as server-provided flags applied to the same player model, never a client username check.
- [ ] Refresh via SSE after balance, progress, notice, account status and leaderboard mutations; recover from an SSE reconnect by fetching current state.
- [ ] Remove stale session and demo-item business fields once all consumers use API state.

### Task 6: Integration and regression verification

**Files:**
- Modify: `fruit-party-web/server/app.spec.js`
- Modify: `fruit-party-web/src/services/api.spec.js`
- Modify: `fruit-party-web/README.md`

- [ ] Run two concurrent browser sessions: administrator changes a player status/privilege/notice and the player page receives the update without reload.
- [ ] Verify normal player, tester and admin authorization boundaries and invalid request handling.
- [ ] Run API tests against MySQL, Vue component tests and a production build.
- [ ] Document the local MySQL prerequisite and the distinction between business persistence and token storage.
