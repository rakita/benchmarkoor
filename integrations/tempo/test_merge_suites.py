#!/usr/bin/env python3
"""Regression tests for merge-suites.py."""

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("merge-suites.py")


class MergeSuitesTests(unittest.TestCase):
    def test_excluded_test_blocks_bridge_to_next_retained_test(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            genesis = root / "genesis.json"
            genesis.write_text("{}\n", encoding="utf-8")
            manifest = root / "manifest.json"
            manifest.write_text(
                json.dumps(
                    {
                        "format": "tempo-engine-suite/v1",
                        "name": "source",
                        "chain": {"genesis": "genesis.json"},
                        "tests": [
                            {
                                "name": "excluded",
                                "setup": [{"method": "setup-excluded"}],
                                "test": [{"method": "test-excluded"}],
                                "cleanup": [{"method": "cleanup-excluded"}],
                            },
                            {
                                "name": "retained",
                                "setup": [{"method": "setup-retained"}],
                                "test": [{"method": "test-retained"}],
                            },
                        ],
                    }
                ),
                encoding="utf-8",
            )
            output = root / "out" / "manifest.json"

            subprocess.run(
                [
                    str(SCRIPT),
                    "--out",
                    str(output),
                    "--exclude-test",
                    "excluded",
                    str(manifest),
                ],
                check=True,
                capture_output=True,
                text=True,
            )

            merged = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(merged["metadata"]["test_count"], "1")
            self.assertEqual(
                [call["method"] for call in merged["tests"][0]["setup"]],
                [
                    "setup-excluded",
                    "test-excluded",
                    "cleanup-excluded",
                    "setup-retained",
                ],
            )
            self.assertEqual(
                merged["tests"][0]["metadata"]["suite_segment_start"], "true"
            )


if __name__ == "__main__":
    unittest.main()
