"""Deliberately break campaign rules, run real tests, and restore bytes exactly.

Run only when no other checks or edits are running. Results stay outside the repo.
"""
from pathlib import Path
import json
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
RESULTS = Path(tempfile.mkdtemp(prefix="puen-campaign-mutations-"))
CMD = ["npx.cmd", "vitest", "run", "lib/campaign.test.ts", "--minWorkers=1", "--maxWorkers=2", "--reporter=json"]


def run(label):
    report = RESULTS / (label + ".json")
    result = subprocess.run(CMD + ["--outputFile=" + str(report)], cwd=ROOT, capture_output=True)
    (RESULTS / (label + ".log")).write_bytes(result.stdout + result.stderr)
    data = json.loads(report.read_text(encoding="utf-8")) if report.exists() else {}
    return result.returncode, data


def replace_function(text, start, end, replacement):
    return text[:text.index(start)] + replacement + text[text.index(end):]


cases = [
    ("validation-bypassed", "lib/campaign.ts", lambda t: replace_function(t, "export function validateVote", "export function reservationQuantity", "export function validateVote(raw: unknown): Validation<VoteInput> { return { ok: true, value: raw as VoteInput }; }\n")),
    ("source-allowlist-removed", "lib/campaign.ts", lambda t: t.replace('if (typeof raw !== "string" || raw.length > 40) return "direct";', 'return "fiesta";')),
    ("reservation-bounds-removed", "lib/campaign.ts", lambda t: t.replace('return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 10 ? raw : null;', 'return 1;')),
    ("season-cutoff-removed", "lib/campaign.ts", lambda t: t.replace('now.getTime() < Date.parse(SEASON_END)', 'true')),
    ("csv-escaping-removed", "lib/campaign.ts", lambda t: t.replace('let text = value == null ? "" : String(value);', 'return String(value);\n  let text = value == null ? "" : String(value);')),
    ("secret-check-removed", "lib/campaign-token.ts", lambda t: t.replace('return secret() !== null;', 'return true;')),
    ("receipt-creation-removed", "lib/campaign-token.ts", lambda t: t.replace('if (!UUID_PATTERN.test(id)) return null;', 'return null;')),
    ("receipt-validation-removed", "lib/campaign-token.ts", lambda t: t.replace('if (typeof raw !== "string" || raw.length > 160) return null;', 'return { id: "forged", expires: 9999999999 };')),
    ("fingerprint-binding-removed", "lib/campaign-token.ts", lambda t: t.replace('JSON.stringify(input)', '"constant"')),
]

clean_exit, clean = run("baseline")
if clean_exit:
    raise SystemExit("Baseline fails; no mutation was made. " + str(RESULTS))
all_tests = {a["fullName"] for r in clean.get("testResults", []) for a in r.get("assertionResults", [])}
killed = set()
records = []
for name, relative, change in cases:
    path = ROOT / relative
    original = path.read_bytes()
    source = original.decode("utf-8")
    mutant = change(source)
    if mutant == source:
        raise SystemExit("Mutation no longer matches: " + name)
    try:
        path.write_bytes(mutant.encode("utf-8"))
        mutant_exit, result = run(name)
    finally:
        path.write_bytes(original)
    restored_exit, _ = run(name + "-restored")
    failed = [a["fullName"] for r in result.get("testResults", []) for a in r.get("assertionResults", []) if a.get("status") == "failed"]
    killed.update(failed)
    records.append({"mutation": name, "file": relative, "mutant_exit": mutant_exit, "restored_exit": restored_exit, "failed_tests": failed})
    print(name, "mutant", mutant_exit, "restored", restored_exit, "failed cases", len(failed), flush=True)
    if mutant_exit == 0 or restored_exit != 0:
        (RESULTS / "summary.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
        raise SystemExit("Mutation gate failed: " + name)
uncovered = sorted(all_tests - killed)
(RESULTS / "summary.json").write_text(json.dumps({"records": records, "uncovered_tests": uncovered}, indent=2), encoding="utf-8")
print("Evidence:", RESULTS)
print("Tests exercised:", len(all_tests), "Tests observed failing:", len(killed), "Uncovered:", uncovered)
raise SystemExit(1 if uncovered else 0)
