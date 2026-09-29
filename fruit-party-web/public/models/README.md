# Fruit Model Sources And Processing

The game needs the following runtime files for every folder in this directory:

```text
<fruit>/whole.glb
<fruit>/halfA.glb
<fruit>/halfB.glb
```

`source.glb` is an offline source file. It is not loaded by the game. Download each source from its page while signed in to Sketchfab, retain the license text, then place it in the matching folder.

| Runtime folder | Source | Author | License |
| --- | --- | --- | --- |
| 西瓜 | [Watermelon photogrammetry](https://sketchfab.com/3d-models/free-low-poly-watermelon-photogrammetry-4k-7d3a7c581ff1448aa0a443ff1de57531) | Naked Singularity Studio | CC Attribution |
| 苹果 | [Realistic Apple](https://sketchfab.com/3d-models/realistic-apple-a8f144765e84450fa706f067bfc70d64) | IsaiahVideo / legoality_films | CC Attribution |
| 橙子 | [Orange and cut half](https://sketchfab.com/3d-models/orange-cut-half-orange-fruit-f8ad567bfc994c8984704877bf1ecbbf) | Kami Rapacz | CC Attribution |
| 猕猴桃 | [Chilean Kiwi](https://sketchfab.com/3d-models/none-16d913f9f7164119bb0da629d6e9cbd3) | mjk | CC Attribution |
| 芒果 | [Colorful Mango](https://sketchfab.com/3d-models/colorful-mango-1c5abb0dd9424a829ea1e16f6a07fc7a) | DigitalSouls | CC Attribution |
| 柠檬 | [Lemon](https://sketchfab.com/3d-models/lemon-bf0c26862a4348799209c2aa21f58d60) | nada.sharafuddin | CC Attribution |

The kiwi source is high polygon and must be decimated before the final mobile build. Optimize source files before export rather than committing the original downloads as runtime assets.

## Generate Cut Models

Install Blender 4.x, then run this command once for each fruit after placing its `source.glb`:

```text
blender --background --python tools/blender/create_fruit_halves.py -- --input public/models/苹果/source.glb --output-dir public/models/苹果
```

The script centers the mesh, exports `whole.glb`, then produces two capped X-axis halves with the original material assignments retained.

## Verify Runtime Files

```text
npm run verify:fruit-assets
```

The command exits with an error until all 18 nonempty runtime GLB files are present.
