# Fruit Party Web

## Local development

Install dependencies once:

```bash
npm ci
```

Use two terminals:

```bash
npm run server
npm run dev
```

The API listens on `http://127.0.0.1:3000`; Vite proxies `/api` requests from its development URL. MySQL is the only persistence layer. Copy `.env.example` to a local `.env`, configure the MySQL connection, then start the API; the server creates and migrates the configured database automatically.

Development seed accounts:

| Username | Password | Role |
| --- | --- | --- |
| `tester` | `Tester123` | player with all test levels unlocked |
| `admin` | `Admin123` | administrator |

Run automated verification:

```bash
npm test
npm run build
npm run verify:fruit-assets
```

For a running API, `node server/live-smoke.mjs` creates a short-lived test player, completes normal level 1 through the API, and verifies level 2 is unlocked.

## 3D fruit rendering

The deployed game uses the built-in procedural Three.js fruit models in `src/game/FruitModelFactory.js`. It does not require external GLB files, so the project can be deployed with the current repository contents.

`FruitAssetManager.js` and `FruitScene.vue` are retained as an optional photorealistic GLB experiment. Missing optional files are reported by the verification command but do not block deployment. To make GLB assets mandatory for a future release, run:

```powershell
$env:REQUIRE_GLTF_ASSETS='1'
npm run verify:fruit-assets
```

Place optional Polyhaven/Blender GLB exports below `public/models`:

```text
public/models/
  西瓜/{whole.glb,halfA.glb,halfB.glb}
  苹果/{whole.glb,halfA.glb,halfB.glb}
  橙子/{whole.glb,halfA.glb,halfB.glb}
  猕猴桃/{whole.glb,halfA.glb,halfB.glb}
  芒果/{whole.glb,halfA.glb,halfB.glb}
  柠檬/{whole.glb,halfA.glb,halfB.glb}
```

`src/game/FruitAssetManager.js` owns loading and cache reuse. Game code calls `preload()`, `spawnFruit()`, `cutFruit()`, and `update()`; it does not calculate scores or write player state. The server remains authoritative for scoring and settlement.
