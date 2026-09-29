"""Generate whole.glb, halfA.glb, and halfB.glb from one licensed fruit source glTF or GLB.

Run with Blender 4.x:
  blender --background --python tools/blender/create_fruit_halves.py -- --input public/models/苹果/source/source.gltf --output-dir public/models/苹果
"""

import argparse
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

FLESH_COLORS = {
    '西瓜': (0.94, 0.17, 0.29, 1.0),
    '苹果': (0.98, 0.89, 0.67, 1.0),
    '橙子': (1.0, 0.43, 0.08, 1.0),
    '猕猴桃': (0.16, 0.38, 0.06, 1.0),
    '芒果': (1.0, 0.65, 0.12, 1.0),
    '柠檬': (1.0, 0.82, 0.18, 1.0),
}

FLESH_RIND_COLORS = {
    '西瓜': (0.08, 0.28, 0.10, 1.0),
    '苹果': (0.45, 0.07, 0.03, 1.0),
    '橙子': (0.62, 0.16, 0.01, 1.0),
    '猕猴桃': (0.12, 0.05, 0.01, 1.0),
    '芒果': (0.43, 0.20, 0.02, 1.0),
    '柠檬': (0.68, 0.49, 0.03, 1.0),
}


def command_arguments():
    separator = sys.argv.index("--") if "--" in sys.argv else len(sys.argv)
    parser = argparse.ArgumentParser(description="Create capped fruit cut halves from a source GLB")
    parser.add_argument("--input", required=True, type=Path, help="Source glTF or GLB downloaded with its license")
    parser.add_argument("--output-dir", required=True, type=Path, help="Fruit runtime-model directory")
    return parser.parse_args(sys.argv[separator + 1:])


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def select_only(object_to_select):
    bpy.ops.object.select_all(action="DESELECT")
    object_to_select.select_set(True)
    bpy.context.view_layer.objects.active = object_to_select


def load_as_single_centered_mesh(source_path):
    bpy.ops.import_scene.gltf(filepath=str(source_path))
    meshes = [object_item for object_item in bpy.context.scene.objects if object_item.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"No mesh objects found in {source_path}")

    # Asset packages often include an invisible low-vertex helper cube. The detailed mesh is the fruit.
    fruit = max(meshes, key=lambda object_item: len(object_item.data.vertices))
    select_only(fruit)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    target_extent = 2.0
    largest_dimension = max(fruit.dimensions)
    if largest_dimension <= 0:
        raise RuntimeError(f"Fruit mesh has invalid dimensions: {source_path}")
    fruit.scale *= target_extent / largest_dimension
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    minimum = Vector((min(vertex.co.x for vertex in fruit.data.vertices), min(vertex.co.y for vertex in fruit.data.vertices), min(vertex.co.z for vertex in fruit.data.vertices)))
    maximum = Vector((max(vertex.co.x for vertex in fruit.data.vertices), max(vertex.co.y for vertex in fruit.data.vertices), max(vertex.co.z for vertex in fruit.data.vertices)))
    center = (minimum + maximum) / 2
    for vertex in fruit.data.vertices:
        vertex.co -= center
    fruit.data.update()
    return fruit


def export_selected_glb(objects, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for object_to_select in objects:
        object_to_select.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(destination),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
    )


def assign_cut_surface_material(fruit_directory):
    material = bpy.data.materials.new(name="Fruit flesh")
    material.diffuse_color = FLESH_COLORS.get(fruit_directory, (0.95, 0.75, 0.48, 1.0))
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = material.diffuse_color
    principled.inputs["Roughness"].default_value = 0.42
    return material


def create_rind_material(fruit_directory):
    material = bpy.data.materials.new(name="Fruit rind")
    material.diffuse_color = FLESH_RIND_COLORS.get(fruit_directory, (0.35, 0.15, 0.04, 1.0))
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = material.diffuse_color
    principled.inputs["Roughness"].default_value = 0.58
    return material


def convex_hull(points):
    unique_points = sorted({(round(point.x, 6), round(point.y, 6)) for point in points})

    def cross(origin, left, right):
        return (left[0] - origin[0]) * (right[1] - origin[1]) - (left[1] - origin[1]) * (right[0] - origin[0])

    if len(unique_points) < 3:
        return unique_points
    lower = []
    for point in unique_points:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], point) <= 0:
            lower.pop()
        lower.append(point)
    upper = []
    for point in reversed(unique_points):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], point) <= 0:
            upper.pop()
        upper.append(point)
    return lower[:-1] + upper[:-1]


def bisect_and_cap(fruit, clear_inner):
    mesh = fruit.data
    mesh_bmesh = bmesh.new()
    mesh_bmesh.from_mesh(mesh)
    bmesh.ops.bisect_plane(
        mesh_bmesh,
        geom=list(mesh_bmesh.verts) + list(mesh_bmesh.edges) + list(mesh_bmesh.faces),
        dist=0.0001,
        plane_co=(0.0, 0.0, 0.0),
        plane_no=(0.0, 0.0, 1.0),
        clear_inner=clear_inner,
        clear_outer=not clear_inner,
    )
    boundary_edges = [
        edge for edge in mesh_bmesh.edges
        if len(edge.link_faces) == 1 and all(abs(vertex.co.z) < 0.001 for vertex in edge.verts)
    ]
    outline = convex_hull([vertex.co for edge in boundary_edges for vertex in edge.verts])
    if len(outline) < 3:
        mesh_bmesh.free()
        raise RuntimeError('Fruit cut did not create a closed flesh surface')
    mesh_bmesh.to_mesh(mesh)
    mesh_bmesh.free()
    mesh.update()
    return outline


def create_flesh_cap(outline, material, rind_material, reverse_normal):
    inner_outline = [(point[0] * 0.84, point[1] * 0.84) for point in outline]
    flesh_vertices = [(0.0, 0.0, 0.0)] + [(point[0], point[1], 0.0) for point in inner_outline]
    flesh_faces = []
    for index in range(len(inner_outline)):
        next_index = (index + 1) % len(inner_outline)
        triangle = (0, index + 1, next_index + 1)
        flesh_faces.append(tuple(reversed(triangle)) if reverse_normal else triangle)
    rind_vertices = [(point[0], point[1], 0.0) for point in inner_outline] + [(point[0], point[1], 0.0) for point in outline]
    rind_faces = []
    outer_offset = len(inner_outline)
    for index in range(len(inner_outline)):
        next_index = (index + 1) % len(inner_outline)
        ring = (index, outer_offset + index, outer_offset + next_index, next_index)
        rind_faces.append(tuple(reversed(ring)) if reverse_normal else ring)
    flesh_mesh = bpy.data.meshes.new(name="Fruit flesh cap")
    flesh_mesh.from_pydata(flesh_vertices, [], flesh_faces)
    flesh_mesh.materials.append(material)
    flesh_object = bpy.data.objects.new("Fruit flesh", flesh_mesh)
    bpy.context.collection.objects.link(flesh_object)
    rind_mesh = bpy.data.meshes.new(name="Fruit rind cap")
    rind_mesh.from_pydata(rind_vertices, [], rind_faces)
    rind_mesh.materials.append(rind_material)
    rind_object = bpy.data.objects.new("Fruit rind", rind_mesh)
    bpy.context.collection.objects.link(rind_object)
    return flesh_object, rind_object


def create_half(source_path, destination, clear_inner):
    clear_scene()
    fruit = load_as_single_centered_mesh(source_path)
    material = assign_cut_surface_material(destination.parent.name)
    rind_material = create_rind_material(destination.parent.name)
    outline = bisect_and_cap(fruit, clear_inner)
    flesh, rind = create_flesh_cap(outline, material, rind_material, reverse_normal=clear_inner)
    export_selected_glb([fruit, flesh, rind], destination)


def main():
    arguments = command_arguments()
    source_path = arguments.input.resolve()
    output_dir = arguments.output_dir.resolve()
    if not source_path.is_file():
        raise FileNotFoundError(f"Source GLB not found: {source_path}")

    clear_scene()
    whole = load_as_single_centered_mesh(source_path)
    export_selected_glb([whole], output_dir / "whole.glb")
    create_half(source_path, output_dir / "halfA.glb", clear_inner=True)
    create_half(source_path, output_dir / "halfB.glb", clear_inner=False)
    print(f"Generated whole.glb, halfA.glb, and halfB.glb in {output_dir}")


if __name__ == "__main__":
    main()
