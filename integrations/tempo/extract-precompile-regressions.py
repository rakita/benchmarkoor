#!/usr/bin/env python3
"""Extract the point-evaluation/RIPEMD-160/SHA-256 regression cases."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any


FILE_FIELDS = ("rlp_file", "bal_file")
TARGETS = (
    "test_point_evaluation.py::test_point_evaluation_uncachable",
    "test_ripemd160.py::",
    "test_sha256.py::",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("out", type=Path)
    return parser.parse_args()


def calls(test: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        json.loads(json.dumps(call))
        for phase in ("setup", "test", "cleanup")
        for call in test.get(phase, [])
    ]


def main() -> None:
    args = parse_args()
    source_path = args.source.resolve()
    output_dir = args.out.resolve()
    output_path = output_dir / "manifest.json"
    if output_path.exists():
        raise SystemExit(f"refusing to replace existing suite: {output_path}")

    source = json.loads(source_path.read_text(encoding="utf-8"))
    selected_segments = {
        test["metadata"]["suite_segment"]
        for test in source["tests"]
        if any(target in test["name"] for target in TARGETS)
    }
    if len(selected_segments) != 1:
        raise SystemExit(f"expected one source segment, found {selected_segments}")
    selected_segment = selected_segments.pop()

    pending_setup: list[dict[str, Any]] = []
    tests: list[dict[str, Any]] = []
    for source_test in source["tests"]:
        if source_test.get("metadata", {}).get("suite_segment") != selected_segment:
            continue
        if not any(target in source_test["name"] for target in TARGETS):
            pending_setup.extend(calls(source_test))
            continue

        test = json.loads(json.dumps(source_test))
        test["setup"] = [*pending_setup, *test.get("setup", [])]
        pending_setup = []
        metadata = dict(test.get("metadata", {}))
        metadata["suite_segment"] = "0"
        if not tests:
            metadata["suite_segment_start"] = "true"
        else:
            metadata.pop("suite_segment_start", None)
        test["metadata"] = metadata
        tests.append(test)

    if len(tests) != 21:
        raise SystemExit(f"expected 21 regression tests, found {len(tests)}")

    output_dir.mkdir(parents=True)
    blocks_dir = output_dir / "blocks"
    blocks_dir.mkdir()
    genesis_source = (source_path.parent / source["chain"]["genesis"]).resolve()
    shutil.copy2(genesis_source, output_dir / "genesis.json")

    for test in tests:
        for phase in ("setup", "test", "cleanup"):
            for call in test.get(phase, []):
                for field in FILE_FIELDS:
                    reference = call.get(field)
                    if not reference:
                        continue
                    source_file = (source_path.parent / reference).resolve()
                    target_file = blocks_dir / source_file.name
                    if not target_file.exists():
                        shutil.copy2(source_file, target_file)
                    call[field] = f"blocks/{source_file.name}"

    manifest = {
        **source,
        "name": "tempo-precompile-chain-regressions",
        "description": (
            "Focused point-evaluation, RIPEMD-160, and SHA-256 regression suite; "
            "earlier precompile blocks are retained as unmeasured setup"
        ),
        "chain": {**source["chain"], "genesis": "genesis.json"},
        "metadata": {
            **source.get("metadata", {}),
            "source_suites": "eest-prague-precompile-basic-10m",
            "segment_count": "1",
            "test_count": str(len(tests)),
        },
        "tests": tests,
    }
    output_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"{output_path}: tests={len(tests)}")


if __name__ == "__main__":
    main()
