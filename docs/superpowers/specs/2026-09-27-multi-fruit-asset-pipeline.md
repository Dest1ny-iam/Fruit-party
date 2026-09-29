# Multi-Fruit Asset Pipeline Design

## Goal

Prepare six separately identifiable realistic fruit models for the existing Three.js preview without changing score, spawn-rate, or settlement rules.

## Asset Contract

Each fruit has one licensed source GLB and three runtime files:

```text
public/models/<Chinese fruit name>/
  source.glb       # local source only, not loaded by the game
  whole.glb        # optimized complete fruit
  halfA.glb        # positive-X cut half
  halfB.glb        # negative-X cut half
```

The runtime manager uses the six canonical IDs `watermelon`, `apple`, `orange`, `kiwi`, `mango`, and `lemon`. It must derive all paths from one shared manifest, so the preview and tooling cannot drift apart.

## Processing

A Blender background script imports one source file, centers and joins its visible mesh geometry, exports the complete fruit, then imports it twice to create capped positive-X and negative-X halves. It preserves the imported materials. A Node validator checks that all eighteen runtime GLBs exist and are nonempty before a release build or browser test.

## Error Handling And Acceptance

The preview retains its existing missing-model message when assets are absent. The validator exits nonzero and lists each missing file. Once Blender and the licensed source models are available, a real cut test must verify that each pair has geometry on opposite sides of its local cut plane and that the preview can randomly spawn and cut all six fruit types.
