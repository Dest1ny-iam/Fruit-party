# Backend Business Completion Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with test-first changes and a verification checkpoint after every task.

**Goal:** Close the remaining backend gaps so game settlement, endless items, maintenance, recharge, profile ledger, admin pagination, realtime refresh, and production data paths are consistent and MySQL-backed.

**Architecture:** Keep Express routes as the HTTP boundary, move business invariants into transaction services, and use MySQL row locks/idempotency keys for all balance, inventory, session, permission, and recharge writes. Keep the existing UI structure; only extend API clients/state wiring where the current page receives placeholder data.

**Tech Stack:** Node.js, Express 5, mysql2/promise, MySQL 8, Vue 2, Vite, Vitest, Supertest, SSE.

---

## Task 1: Establish server-session settlement authority

**Files:**
- Modify: `server/schema.mysql.sql` (`game_sessions` fields and indexes)
- Modify: `server/business.js` (session lookup and item/session helpers)
- Modify: `server/app.js` (`/api/game/settlements`, session-aware revive/item routes)
- Modify: `src/services/api.js` and `src/App.vue` (send sessionId)
- Test: `server/app.spec.js`, `server/business.mysql.spec.js`

- [ ] Write failing integration tests for cross-user sessions, wrong mode/level, duplicate settlement, and concurrent settlement.
- [ ] Run `npx vitest run server/app.spec.js server/business.mysql.spec.js` and confirm the new tests fail because settlement does not read `sessionId`.
- [ ] Add a transaction service that locks `game_sessions` with `FOR UPDATE`, validates owner/mode/level/status, and returns the previous result for `settled` sessions.
- [ ] Pass `currentGameEntry.sessionId` from `App.vue` to `settleGame`.
- [ ] Persist `attempt_id`, `settled_at`, and a settlement response snapshot or deterministic lookup data.
- [ ] Add the exact duplicate and concurrent assertions, then run the focused tests until green.

## Task 2: Make endless item activation and revive server-authoritative

**Files:**
- Modify: `server/schema.mysql.sql` (add `game_session_items` and session state columns)
- Modify: `server/items.js` (session-bound consumption)
- Modify: `server/business.js` (activation/revive transaction services)
- Modify: `server/app.js` (new session item/revive routes)
- Modify: `src/components/GameBoard.vue`, `src/App.vue`, `src/services/api.js`
- Test: `server/items.spec.js`, `server/business.mysql.spec.js`, `server/app.spec.js`

- [ ] Write failing tests for three endless revives, one-use active cards, 20-second expiry, and revive on a foreign/settled session.
- [ ] Run the focused tests and confirm failures before implementation.
- [ ] Add `game_session_items` rows at entry time with allowed uses and server timestamps.
- [ ] Add `POST /api/game/sessions/:sessionId/items/:itemKey/activate` and `POST /api/game/sessions/:sessionId/revive`.
- [ ] Lock both the session and inventory row in one transaction; reject exhausted or expired effects.
- [ ] Return server timestamps and remaining uses so the client renders, but does not decide, validity.
- [ ] Remove client-only authority for `scoreBoost`, bomb suppression count, and revive count from settlement input; retain client state only for animation.

## Task 3: Complete recharge order lifecycle

**Files:**
- Modify: `server/schema.mysql.sql` (payment confirmation/idempotency fields and indexes)
- Modify: `server/business.js` (order lookup, expiry, confirmation and benefit grant services)
- Modify: `server/app.js` (player order query and admin order routes)
- Modify: `src/services/api.js`, `src/components/PlayerActionDrawer.vue`, `src/components/AdminConsole.vue`
- Test: `server/business.mysql.spec.js`, `server/app.spec.js`, `src/services/api.spec.js`

- [ ] Write failing tests for order lookup, expired confirmation, duplicate confirmation, coin grant, item grant, and audit logging.
- [ ] Run focused tests and verify they fail because no confirmation endpoint exists.
- [ ] Add a transaction that locks `recharge_orders`, validates `pending` and `expires_at`, grants the normalized benefits, writes wallet/inventory ledger rows, and sets `paid_at`.
- [ ] Add `GET /api/recharge-orders/:orderNo`, `GET /api/admin/recharge-orders`, `POST /api/admin/recharge-orders/:orderNo/confirm`, and cancel/expire handling.
- [ ] Use an order number and benefit-grant reference as an idempotency key.
- [ ] Publish player-state after a successful confirmation and verify duplicate requests return the original grant result.

## Task 4: Persist maintenance mode and broadcast it

**Files:**
- Modify: `server/schema.mysql.sql` (add `system_settings`)
- Create: `server/system-status.js`
- Modify: `server/app.js`, `server/realtime.js`
- Modify: `src/services/api.js`, `src/App.vue`, `src/components/AdminConsole.vue`
- Test: `server/app.spec.js`, `server/realtime.spec.js`, `src/services/api.spec.js`, `src/App.spec.js`

- [ ] Write failing tests for public status, admin update, non-admin rejection, new-game blocking, and SSE `maintenance-changed` events.
- [ ] Run focused tests and confirm the current local-only toggle does not satisfy them.
- [ ] Add `system_settings` read/write helpers with one-row locking and audit logging.
- [ ] Add `GET /api/system/status`, `GET /api/admin/system/maintenance`, and `PATCH /api/admin/system/maintenance`.
- [ ] Block new game entries and other player write operations with `503 MAINTENANCE`; allow health checks and administrator access.
- [ ] On the client, pause the active game overlay on the SSE event and reload authoritative status when maintenance ends.
- [ ] Remove production dependence on `src/state/system-status.js` localStorage state.

## Task 5: Add real wallet ledger API and remove placeholder data

**Files:**
- Modify: `server/app.js` (wallet ledger route)
- Modify: `src/services/api.js`, `src/App.vue`, `src/components/ProfilePage.vue`
- Test: `server/app.spec.js`, `src/services/api.spec.js`, `src/App.spec.js`, `src/components/ProfilePage.spec.js`

- [ ] Write a failing test that expects the profile to request and render the first page of wallet ledger entries.
- [ ] Run the focused tests and confirm the fixed `coin-ledger=[]` path fails the new assertion.
- [ ] Add `GET /api/me/wallet/ledger?page=1&pageSize=20` backed by `wallet_ledger`, with a stable title mapping and total count.
- [ ] Load the ledger with player state when opening the profile and pass the API result to `ProfilePage`.
- [ ] Keep an empty-state message only when the database genuinely returns zero rows.
- [ ] Search production files for fixed business arrays and remove or replace each reference.

## Task 6: Complete admin item CRUD and server-side pagination

**Files:**
- Modify: `server/app.js` (item list/create/update/status routes)
- Modify: `src/services/api.js`, `src/components/AdminConsole.vue`
- Test: `server/app.spec.js`, `src/services/api.spec.js`, `src/components/AdminConsole.spec.js`

- [ ] Write failing tests for item page metadata, keyword filtering, create, edit, enable/disable, validation, and audit entries.
- [ ] Run focused tests and confirm only price update exists.
- [ ] Implement `GET /api/admin/items?page&pageSize&keyword`, `POST /api/admin/items`, `PATCH /api/admin/items/:id`, and `PATCH /api/admin/items/:id/status`.
- [ ] Validate unique `itemKey`, positive price, quantity bounds, and enabled-state rules in the service layer.
- [ ] Return `{ items, page, pageSize, total }` and preserve the existing UI data mapping.
- [ ] Add server pagination to player and recharge-order lists using the same response shape.

## Task 7: Add admin realtime refresh and failure-safe loading

**Files:**
- Modify: `server/realtime.js`, `server/app.js`
- Modify: `src/services/api.js`, `src/components/AdminConsole.vue`, `src/components/AdminPermissionCenter.vue`, `src/components/AdminRechargeProducts.vue`
- Test: `server/realtime.spec.js`, component tests and API tests

- [ ] Write failing tests for admin event subscription and stale-data retention on a failed refresh.
- [ ] Add an authenticated admin SSE channel or scoped change events for players, items, orders, notifications, permissions, and audit logs.
- [ ] Reload only the affected module after an event; retain existing rows when a request fails.
- [ ] Add a 15-second polling fallback with cleanup on component destruction.
- [ ] Confirm two browser sessions observe player disable, permission, coin grant, and recharge confirmation changes.

## Task 8: Security and operational hardening

**Files:**
- Modify: `server/app.js`, `server/auth.js`, `server/index.js`, `vite.config.js`, `.env.example`
- Create: `server/rate-limit.js`, deployment configuration files as needed
- Test: auth/API integration tests and deployment smoke checks

- [ ] Write failing tests for missing production JWT secret, CORS rejection, login throttling, and oversized/invalid image upload.
- [ ] Require `JWT_SECRET` in production, use an explicit CORS allowlist, and add bounded login/admin rate limits.
- [ ] Validate upload MIME, byte size, and generated storage names before updating database URLs.
- [ ] Add migration version tracking instead of relying only on startup schema execution.
- [ ] Document PM2, Nginx, HTTPS, firewall, backup, and rollback commands in the desktop deployment document.

## Task 9: Verification checkpoint

- [ ] Run `npm test` and record the exact number of passing files/tests.
- [ ] Run `npm run build`.
- [ ] Run `npm run verify:fruit-assets` and record missing models separately from backend status.
- [ ] Run MySQL integration, duplicate-request, and concurrent-request suites against isolated databases.
- [ ] Run a two-account browser smoke test: normal player and admin/tester.
- [ ] Review `git diff` for accidental UI changes before committing.
