"""Mutation-prove the two observed NC layout regressions on an owned preview."""
import argparse
import json
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    out = Path(args.output).resolve()
    out.mkdir(parents=True, exist_ok=True)
    root = Path(__file__).resolve().parents[1]
    cases = [
        ("header-whole-fix", root / "components/retail/SiteHeader.tsx", "enlarged-text-overflow", 768, [
            (b"container-page flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2", b"container-page flex h-16 items-center justify-between"),
            (b"flex min-h-11 min-w-0 flex-1 flex-wrap items-baseline gap-2 py-1.5", b"flex min-h-11 items-baseline gap-2 py-1.5"),
            (b"break-words font-display text-2xl font-bold text-ink", b"font-display text-2xl font-bold text-ink"),
        ]),
        ("player-width", root / "components/neighborhood/NcPortalPage.tsx", "horizontal-overflow", 320, [
            (b"mt-6 aspect-video min-h-[200px] w-full", b"mt-6 aspect-video min-h-[200px]"),
        ]),
    ]
    proof = []
    for label, target, expected_failure, expected_width, replacements in cases:
        original = target.read_bytes()
        changed = original
        for before, after in replacements:
            assert changed.count(before) == 1, label
            changed = changed.replace(before, after)
        try:
            target.write_bytes(changed)
            mutant = subprocess.run([sys.executable, str(root / "scripts/verify-nc-geometry.py"),
                                     "--output", str(out / (label + "-mutant"))],
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180)
            (out / (label + "-mutant.log")).write_bytes(mutant.stdout)
        finally:
            target.write_bytes(original)
        restored = subprocess.run([sys.executable, str(root / "scripts/verify-nc-geometry.py"),
                                   "--output", str(out / (label + "-restored"))],
                                  stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180)
        (out / (label + "-restored.log")).write_bytes(restored.stdout)
        mutant_report = json.loads((out / (label + "-mutant") / "geometry-results.json").read_text(encoding="utf-8"))
        restored_report = json.loads((out / (label + "-restored") / "geometry-results.json").read_text(encoding="utf-8"))
        row = {"mutation": label, "mutantExit": mutant.returncode,
               "restoredExit": restored.returncode, "bytesRestored": target.read_bytes() == original,
               "observedFailure": mutant_report.get("failureKind"),
               "observedWidth": mutant_report.get("failureViewport")}
        proof.append(row)
        print(json.dumps(row), flush=True)
        assert mutant.returncode != 0 and restored.returncode == 0 and row["bytesRestored"]
        assert row["observedFailure"] == expected_failure and row["observedWidth"] == expected_width, row
        assert restored_report.get("result") == "passed"
    (out / "mutation-proof.json").write_text(json.dumps(proof, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
