import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('Blender fruit export script', () => {
  it('selects the detailed fruit mesh and normalizes its largest dimension before export', async () => {
    const scriptPath = join(dirname(fileURLToPath(import.meta.url)), 'create_fruit_halves.py')
    const script = await readFile(scriptPath, 'utf8')

    expect(script).toContain('max(meshes, key=lambda object_item: len(object_item.data.vertices))')
    expect(script).toContain('target_extent = 2.0')
    expect(script).toContain('assign_cut_surface_material')
    expect(script).toContain("'猕猴桃': (0.16, 0.38, 0.06, 1.0)")
    expect(script).toContain('plane_no=(0.0, 0.0, 1.0)')
    expect(script).toContain('boundary_edges')
    expect(script).toContain('vertex.co -= center')
    expect(script).toContain('import bmesh')
    expect(script).toContain('bmesh.ops.bisect_plane')
    expect(script).toContain('def convex_hull')
    expect(script).toContain('flesh_mesh.from_pydata')
    expect(script).toContain('FLESH_RIND_COLORS')
    expect(script).toContain('rind_mesh.from_pydata')
  })
})
