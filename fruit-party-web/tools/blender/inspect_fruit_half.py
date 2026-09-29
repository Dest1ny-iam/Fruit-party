import sys

import bpy


def main():
    bpy.ops.import_scene.gltf(filepath=sys.argv[-1])
    print('MATERIALS', [(item.name, tuple(round(value, 3) for value in item.diffuse_color)) for item in bpy.data.materials])
    for item in bpy.context.scene.objects:
        if item.type != 'MESH':
            continue
        print('MESH', item.name, 'POLYGONS', len(item.data.polygons), 'SLOTS', [slot.name for slot in item.data.materials])
        candidates = [polygon for polygon in item.data.polygons if abs(polygon.center.z) < 0.02 and abs(polygon.normal.z) > 0.95]
        print('FRONT-FACING-CAPS', [
            (polygon.material_index, tuple(round(value, 3) for value in polygon.center), tuple(round(value, 3) for value in polygon.normal))
            for polygon in candidates
        ])


if __name__ == '__main__':
    main()
