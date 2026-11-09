"""Build the cached, pre-authored low-poly cempasuchil floor decoration GLB."""

from __future__ import annotations

import json
import math
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/models/cempasuchil-floor-200.glb"
MOBILE_OUTPUT = ROOT / "public/models/cempasuchil-floor-200-mobile.glb"
COLORS = ["#FF8C00", "#FFAD01", "#FFA500", "#FFD700"]
SEGMENTS = 6
PETALS = 7
FLOWER_COUNT = 200
FLOWERS_PER_RING = 50
RING_COUNT = FLOWER_COUNT // FLOWERS_PER_RING
GOLDEN_ANGLE = math.pi * (3 - math.sqrt(5))


def linear_channel(value: int) -> float:
    value /= 255
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def color_factor(hex_color: str) -> list[float]:
    values = [int(hex_color[index:index + 2], 16) for index in (1, 3, 5)]
    return [linear_channel(value) for value in values] + [1.0]


def face_normal(a: tuple[float, float, float], b: tuple[float, float, float], c: tuple[float, float, float]):
    ab = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
    ac = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
    normal = (
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
    )
    length = math.sqrt(sum(component * component for component in normal)) or 1
    return tuple(component / length for component in normal)


def triangles_to_accessor(triangles: list[tuple[tuple[float, float, float], ...]], binary: bytearray):
    while len(binary) % 4:
        binary.append(0)
    start = len(binary)
    positions: list[float] = []
    normals: list[float] = []
    for triangle in triangles:
        normal = face_normal(*triangle)
        for point in triangle:
            positions.extend(point)
            normals.extend(normal)
    for value in positions:
        binary.extend(struct.pack("<f", value))
    normal_offset = len(binary)
    for value in normals:
        binary.extend(struct.pack("<f", value))
    count = len(positions) // 3
    position_accessor = {
        "bufferView": len(buffer_views), "componentType": 5126, "count": count,
        "type": "VEC3", "min": [min(positions[i::3]) for i in range(3)],
        "max": [max(positions[i::3]) for i in range(3)],
    }
    buffer_views.append({"buffer": 0, "byteOffset": start, "byteLength": normal_offset - start})
    accessors.append(position_accessor)
    normal_view = len(buffer_views)
    buffer_views.append({"buffer": 0, "byteOffset": normal_offset, "byteLength": len(binary) - normal_offset})
    normal_accessor = len(accessors)
    accessors.append({"bufferView": normal_view, "componentType": 5126, "count": count, "type": "VEC3"})
    return len(accessors) - 2, normal_accessor


def hemisphere_cap(
    radius: float,
    bottom: float,
    top: float,
    offset_x: float = 0,
    offset_z: float = 0,
    segments: int = SEGMENTS,
):
    triangles = []
    apex = (offset_x, top, offset_z)
    base_ring = [
        (offset_x + radius * math.cos(2 * math.pi * index / segments), bottom,
         offset_z + radius * math.sin(2 * math.pi * index / segments))
        for index in range(segments)
    ]
    middle_radius = radius * 0.72
    middle_y = bottom + (top - bottom) * 0.66
    middle_ring = [
        (offset_x + middle_radius * math.cos(2 * math.pi * index / segments), middle_y,
         offset_z + middle_radius * math.sin(2 * math.pi * index / segments))
        for index in range(segments)
    ]
    for index in range(segments):
        next_index = (index + 1) % segments
        triangles.append((base_ring[index], base_ring[next_index], middle_ring[next_index]))
        triangles.append((base_ring[index], middle_ring[next_index], middle_ring[index]))
        triangles.append((apex, middle_ring[next_index], middle_ring[index]))
    return triangles


def make_petal_cluster(petals: int = PETALS, segments: int = SEGMENTS):
    triangles = []
    for petal in range(petals):
        angle = 2 * math.pi * petal / petals
        triangles.extend(hemisphere_cap(
            radius=0.145,
            bottom=0.0,
            top=0.15,
            offset_x=0.12 * math.cos(angle),
            offset_z=0.12 * math.sin(angle),
            segments=segments,
        ))
    return triangles


def make_spark_octahedron(radius: float):
    top = (0, radius, 0)
    bottom = (0, -radius, 0)
    east = (radius, 0, 0)
    west = (-radius, 0, 0)
    north = (0, 0, radius)
    south = (0, 0, -radius)
    return [
        (top, east, north), (top, north, west),
        (top, west, south), (top, south, east),
        (bottom, north, east), (bottom, west, north),
        (bottom, south, west), (bottom, east, south),
    ]


def build_glb(output: Path = OUTPUT, segments: int = SEGMENTS, petals: int = PETALS):
    global buffer_views, accessors
    buffer_views = []
    accessors = []
    binary = bytearray()
    meshes = []
    materials = []
    nodes = []
    roots = []

    for color in COLORS:
        materials.append({
            "name": f"cempasuchil-{color[1:]}",
            "pbrMetallicRoughness": {
                "baseColorFactor": color_factor(color),
                "metallicFactor": 0,
                "roughnessFactor": 0.92,
            },
            "doubleSided": True,
        })

    petal_meshes = []
    petal_triangles = make_petal_cluster(petals=petals, segments=segments)
    for material_index in range(3):
        position_accessor, normal_accessor = triangles_to_accessor(petal_triangles, binary)
        petal_meshes.append(len(meshes))
        meshes.append({
            "name": f"flower-petals-{COLORS[material_index][1:]}",
            "primitives": [{
                "attributes": {"POSITION": position_accessor, "NORMAL": normal_accessor},
                "material": material_index,
                "mode": 4,
            }],
        })

    core_meshes = []
    core_triangles = hemisphere_cap(radius=0.078, bottom=0.095, top=0.195, segments=segments)
    for material_index in (3, 1):
        position_accessor, normal_accessor = triangles_to_accessor(core_triangles, binary)
        core_meshes.append(len(meshes))
        meshes.append({
            "name": f"flower-heart-{COLORS[material_index][1:]}",
            "primitives": [{
                "attributes": {"POSITION": position_accessor, "NORMAL": normal_accessor},
                "material": material_index,
                "mode": 4,
            }],
        })

    spark_position, spark_normal = triangles_to_accessor(make_spark_octahedron(.045), binary)
    spark_mesh = len(meshes)
    meshes.append({
        "name": "cempasuchil-orange-spark",
        "primitives": [{
            "attributes": {"POSITION": spark_position, "NORMAL": spark_normal},
            "material": 0,
            "mode": 4,
        }],
    })

    for index in range(FLOWER_COUNT):
        # Interleave the rings so every prefix (including the first 23) is
        # distributed around the altar instead of filling one circle first.
        ring = index % RING_COUNT
        position_in_ring = index // RING_COUNT
        angle = position_in_ring * GOLDEN_ANGLE + ring * 0.47
        angle += 0.045 * math.sin(index * 1.91)
        ring_radius = 3.12 + ring * 0.34
        radius_x = ring_radius + 0.075 * math.sin(index * 2.31)
        radius_z = ring_radius * 0.95 + 0.075 * math.cos(index * 1.73)
        x = radius_x * math.cos(angle)
        z = radius_z * math.sin(angle)
        root_index = len(nodes)
        roots.append(root_index)
        nodes.append({
            "name": f"flower-{index + 1:02d}",
            "translation": [x, 0, z],
            "rotation": [0, math.sin(angle / 2), 0, math.cos(angle / 2)],
            "children": [root_index + 1, root_index + 2],
        })
        petal_variant = index % len(petal_meshes)
        core_variant = 0 if index % 3 else 1
        nodes.append({"name": f"flower-{index + 1:02d}-petals", "mesh": petal_meshes[petal_variant]})
        nodes.append({"name": f"flower-{index + 1:02d}-center", "mesh": core_meshes[core_variant]})

    particle_node_index = len(nodes)
    nodes.append({"name": "flower-spark-prototype", "mesh": spark_mesh})
    roots.append(particle_node_index)

    while len(binary) % 4:
        binary.append(0)
    document = {
        "asset": {"version": "2.0", "generator": "Memoria Viva static cempasuchil builder"},
        "scene": 0,
        "scenes": [{"name": "Cempasuchil floor flowers", "nodes": roots}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": materials,
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
    }
    json_chunk = json.dumps(document, separators=(",", ":")).encode("utf-8")
    json_chunk += b" " * ((4 - len(json_chunk) % 4) % 4)
    binary.extend(b"\x00" * ((4 - len(binary) % 4) % 4))
    total_length = 12 + 8 + len(json_chunk) + 8 + len(binary)
    glb = bytearray(struct.pack("<4sII", b"glTF", 2, total_length))
    glb.extend(struct.pack("<I4s", len(json_chunk), b"JSON"))
    glb.extend(json_chunk)
    glb.extend(struct.pack("<I4s", len(binary), b"BIN\x00"))
    glb.extend(binary)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(glb)
    triangles_per_flower = (petals + 1) * segments * 3
    print(
        f"Wrote {output} ({len(glb)} bytes, {FLOWER_COUNT} flowers, "
        f"{FLOWER_COUNT * triangles_per_flower} triangles)"
    )


if __name__ == "__main__":
    build_glb(OUTPUT, segments=SEGMENTS, petals=PETALS)
    build_glb(MOBILE_OUTPUT, segments=4, petals=4)
