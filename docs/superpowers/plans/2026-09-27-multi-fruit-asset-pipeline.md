# Multi-Fruit Asset Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the six runtime fruit folders verifiable and generateable from licensed GLB sources while keeping game rules untouched.

**Architecture:** A shared JavaScript manifest owns fruit IDs, Chinese asset directories, and the three runtime variants. The Three.js manager and preview consume it. Blender performs mesh slicing offline; a Node CLI validates all produced GLBs asynchronously.

**Tech Stack:** Vue 2, Vitest, Three.js, Node.js, Blender Python.

---

### Task 1: Shared manifest

**Files:**
- Create: `fruit-party-web/src/game/fruit-assets.js`
- Modify: `fruit-party-web/src/game/FruitAssetManager.js`
- Modify: `fruit-party-web/src/game/FruitAssetManager.spec.js`

- [ ] Add failing assertions for the six canonical IDs, three paths per ID, and generated Chinese model paths.
- [ ] Implement the frozen manifest and refactor the manager to use it.
- [ ] Run `npm test -- src/game/FruitAssetManager.spec.js` and commit the manifest.

### Task 2: Offline processing and validation

**Files:**
- Create: `fruit-party-web/tools/blender/create_fruit_halves.py`
- Create: `fruit-party-web/tools/verify-fruit-assets.mjs`
- Create: `fruit-party-web/public/models/README.md`
- Test: `fruit-party-web/src/game/FruitAssetManager.spec.js`

- [ ] Write a failing validator expectation for absent required runtime files.
- [ ] Implement an async validator and Blender background script that produces whole/halfA/halfB from source.glb.
- [ ] Run the validator to confirm it reports the absent assets, then run the unit suite and build.

### Task 3: Real-asset acceptance

**Files:**
- Populate: `fruit-party-web/public/models/<fruit>/source.glb`
- Generate: `fruit-party-web/public/models/<fruit>/{whole,halfA,halfB}.glb`

- [ ] Install Blender and place the six licensed source files after downloading them through a licensed Sketchfab account.
- [ ] Run the Blender script once per fruit, then run the validator expecting eighteen nonempty GLBs.
- [ ] Launch the 3D preview and verify all six fruits can spawn and cut without a missing-model message.
