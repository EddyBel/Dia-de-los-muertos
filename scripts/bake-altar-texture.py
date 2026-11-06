"""Bake the approved front color reference into the altar's UV texture atlas."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/textures/altar-color-reference.png"
OUTPUT = ROOT / "public/textures/altar-color-uv.png"

# Measured STL bounds (millimetres) and the alignment chosen in developer mode.
MIN_X, MAX_X = -120.278244, 120.132721
MIN_Z, MAX_Z = 0.0, 236.300018
OFFSET_X, OFFSET_Z = -8.0, -7.5
SCALE_X, SCALE_Z = 1.11, 1.06
ATLAS_SIZE = (2048, 2048)
BASE_COLOR = (201, 185, 173, 255)


def main():
    reference = Image.open(SOURCE).convert("RGBA")
    source_width, source_height = reference.size
    atlas_width, atlas_height = ATLAS_SIZE
    model_width = MAX_X - MIN_X
    model_height = MAX_Z - MIN_Z
    projection_min_x = MIN_X + OFFSET_X + model_width * (1 - SCALE_X) * 0.5
    projection_min_z = MIN_Z + OFFSET_Z + model_height * (1 - SCALE_Z) * 0.5

    # Output atlas pixels correspond to STL UVs. The affine transform samples
    # the reference at the calibrated X/Z position for each point on the model.
    affine = (
        source_width / (atlas_width * SCALE_X),
        0,
        (MIN_X - projection_min_x) * source_width / (model_width * SCALE_X),
        0,
        source_height / (atlas_height * SCALE_Z),
        source_height * (1 - (MAX_Z - projection_min_z) / (model_height * SCALE_Z)),
    )
    sampled = reference.transform(
        ATLAS_SIZE,
        Image.Transform.AFFINE,
        affine,
        resample=Image.Resampling.BICUBIC,
        fillcolor=(0, 0, 0, 0),
    )
    base = Image.new("RGBA", ATLAS_SIZE, BASE_COLOR)
    base.alpha_composite(sampled)
    base.convert("RGB").save(OUTPUT, "PNG", optimize=True)
    print(f"Baked {OUTPUT.relative_to(ROOT)} ({atlas_width}x{atlas_height})")


if __name__ == "__main__":
    main()
