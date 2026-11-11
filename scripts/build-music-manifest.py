#!/usr/bin/env python3
"""Build a browser-readable manifest from MP3 files in public/musica."""

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=ROOT / "public" / "musica")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    source = args.source.resolve()
    output = args.output.resolve() if args.output else source / "playlist.json"
    tracks = [
        {
            "title": path.stem,
            "file": path.relative_to(source).as_posix(),
        }
        for path in sorted(source.rglob("*"), key=lambda item: item.as_posix().casefold())
        if path.is_file() and path.suffix.lower() == ".mp3"
    ]
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(tracks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Manifest created: {output} ({len(tracks)} MP3 files)")


if __name__ == "__main__":
    main()
