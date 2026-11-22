"""Deliberately break campaign rules, run real tests, and restore bytes exactly.

Run only when no other checks or edits are running. Results stay outside the repo.
"""
from pathlib import Path
import json
import subprocess
import tempfile
import sys

ROOT = Path(__file__).resolve().parent.parent
RESULTS = Path(tempfile.mkdtemp(prefix="puen-campaign-mutations-"))
GROUP = sys.argv[1] if len(sys.argv) > 1 else "domain"
TESTS = {"domain": ["lib/campaign.test.ts"], "store": ["lib/campaign-store.test.ts"],
         "delivery": ["lib/campaign-delivery.test.ts", "lib/campaign-http.test.ts", "app/api/campaign/routes.test.ts"],
         "ui": ["components/campaign/Campaign.dom.test.tsx", "lib/campaign-client.test.ts"]}
if GROUP not in TESTS:
    raise SystemExit("Choose domain, store, delivery or ui")
CMD = ["npx.cmd", "vitest", "run", *TESTS[GROUP], "--minWorkers=1", "--maxWorkers=2", "--reporter=json"]


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
if GROUP == "store":
    cases = [
        ("save-removed", "lib/campaign-store.ts", lambda t: replace_function(t, "export async function saveVote", "export interface CampaignVote", 'export async function saveVote(input: VoteInput): Promise<SaveVote> { return { status: "duplicate" }; }\n')),
        ("duplicate-contract-broken", "lib/campaign-store.ts", lambda t: t.replace('return { status: row.status };', 'return { status: "unavailable" };')),
        ("receipt-row-read-removed", "lib/campaign-store.ts", lambda t: t.replace('if (!client || !UUID_PATTERN.test(id)) return null;', 'return null;')),
        ("reservation-write-removed", "lib/campaign-store.ts", lambda t: t.replace('const row = record(data);\n    return !error && row', 'const row = record(data);\n    return { status: "unavailable" };\n    return !error && row')),
        ("readiness-gate-removed", "lib/campaign-store.ts", lambda t: t.replace('if (!client || !storageClient || !campaignConfigured()) return false;', 'return true;')),
        ("kit-delivery-removed", "lib/campaign-store.ts", lambda t: t.replace('if (!storageClient) return null;', 'return null;')),
        ("outbox-claim-removed", "lib/campaign-store.ts", lambda t: t.replace('p_limit: voteId ? 2 : 3', 'p_limit: 100000')),
        ("acknowledgement-blind", "lib/campaign-store.ts", lambda t: t.replace('return !error && data === true;', 'return true;')),
        ("pagination-unbounded", "lib/campaign-store.ts", lambda t: t.replace('.limit(CAMPAIGN_PAGE_SIZE)', '.limit(100000)')),
    ]
if GROUP == "delivery":
    cases = [
        ("delivery-removed", "lib/campaign-delivery.ts", lambda t: t.replace('const jobs = await claimCampaignJobs(voteId);', 'return { ok: true, accepted: 100, pending: 0 };\n  const jobs = await claimCampaignJobs(voteId);')),
        ("worker-authentication-removed", "lib/campaign-delivery.ts", lambda t: t.replace('if (!workerConfigured() || !header) return false;', 'return true;')),
        ("worker-configuration-removed", "lib/campaign-delivery.ts", lambda t: t.replace('return (process.env.CRON_SECRET?.length ?? 0) >= 32;', 'return false;')),
        ("body-validation-removed", "lib/campaign-http.ts", lambda t: t.replace('const origin = req.headers.get("origin");', 'return { ok: true, body: {} };\n  const origin = req.headers.get("origin");')),
        ("public-vote-removed", "app/api/campaign/vote/route.ts", lambda t: t.replace('const parsed = await readCampaignJson(req);', 'return campaignJson({ receipt: "invalid" });\n  const parsed = await readCampaignJson(req);')),
        ("kit-authorization-removed", "app/api/campaign/kit/route.ts", lambda t: t.replace('if (!await receiptVote(parsed.body.receipt))', 'if (false)')),
        ("reservation-mode-check-removed", "app/api/campaign/reserve/route.ts", lambda t: t.replace('if (!isStripeTestMode())', 'if (false)')),
        ("receipt-revocation-check-removed", "lib/campaign-http.ts", lambda t: t.replace('return vote && !vote.revoked ? vote : null;', 'return vote;')),
        ("private-email-disclosed", "app/api/campaign/receipt/route.ts", lambda t: t.replace('firstName: vote.firstName,', 'email: vote.email, firstName: vote.firstName,')),
        ("kit-readiness-removed", "app/api/campaign/kit/route.ts", lambda t: t.replace('if (!await campaignReady())', 'if (false)')),
        ("reservation-save-removed", "app/api/campaign/reserve/route.ts", lambda t: t.replace('const saved = await reserveCopy(vote.id, quantity);', 'return campaignJson({});\n  const saved = await reserveCopy(vote.id, quantity);')),
        ("receipt-route-removed", "app/api/campaign/receipt/route.ts", lambda t: t.replace('const parsed = await readCampaignJson(req);', 'return campaignJson({});\n  const parsed = await readCampaignJson(req);')),
    ]
if GROUP == "ui":
    cases = [
        ("vote-form-removed", "components/campaign/VoteForm.tsx", lambda t: t.replace('const router = useRouter();', 'return <div />;\n  const router = useRouter();')),
        ("receipt-screen-removed", "components/campaign/CampaignReceipt.tsx", lambda t: t.replace('const [receipt, setReceipt] = useState("");', 'return <div />;\n  const [receipt, setReceipt] = useState("");')),
        ("secure-uuid-removed", "lib/campaign-client.ts", lambda t: t.replace('if (typeof crypto.randomUUID === "function") return crypto.randomUUID();', 'return "00000000-0000-4000-8000-000000000001";')),
        ("download-protocol-check-removed", "lib/campaign-client.ts", lambda t: t.replace('if (typeof raw !== "string" || new URL(raw).protocol !== "https:")', 'if (false)')),
        ("download-navigation-removed", "lib/campaign-client.ts", lambda t: t.replace('window.location.assign(raw);', 'return;')),
        ("request-timeout-removed", "lib/campaign-client.ts", lambda t: t.replace('controller.abort(), 30000', 'controller.abort(), 300000')),
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
    source = original.decode("utf-8").replace("\r\n", "\n")
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
