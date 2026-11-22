"""Execute campaign SQL and two-session races on an isolated local PostgreSQL.

Uses supplied portable binaries, never a hosted database or .env file.
python supabase/checks/run_campaign_local.py --pg-bin <bin> --output <private-folder>
"""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pg-bin", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    binaries = Path(args.pg_bin).resolve()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    data = Path(tempfile.mkdtemp(prefix="campaign-postgres-", dir=output))
    repo = Path(__file__).resolve().parents[2]
    report = {"engine": "real local PostgreSQL", "hostedSupabaseVerified": False, "checks": []}
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    env = os.environ.copy()
    env.update({"PGHOST": "127.0.0.1", "PGPORT": str(port), "PGUSER": "campaign_qa",
                "PGDATABASE": "postgres", "PGCONNECT_TIMEOUT": "5",
                "PGOPTIONS": "-c statement_timeout=12000"})
    # Prevent an inherited connection string or password from selecting remote state.
    for name in ["PGSERVICE", "PGSERVICEFILE", "PGPASSWORD", "PGPASSFILE"]:
        env.pop(name, None)
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0

    def command(name):
        return str(binaries / (name + (".exe" if os.name == "nt" else "")))

    def run(cmd, timeout=30):
        # The Windows server can inherit pg_ctl's output handle. A pipe would
        # keep communicate() waiting after pg_ctl exits; a file has no such EOF.
        with tempfile.TemporaryFile(mode="w+", encoding="utf-8") as captured:
            result = subprocess.run(cmd, stdout=captured, stderr=subprocess.STDOUT,
                                    env=env, timeout=timeout, creationflags=flags)
            captured.seek(0)
            stdout = captured.read()
        if result.returncode:
            raise RuntimeError(stdout)
        return stdout

    psql = [command("psql"), "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"]

    def sql(query, role=None):
        if role:
            assert role in {"anon", "authenticated", "service_role"}
            query = "set role " + role + "; " + query
        return run(psql + ["-c", query]).strip()

    def check(name, **details):
        report["checks"].append({"name": name, "result": "passed", **details})
        print("PASS:", name, flush=True)

    def request(submission=None, email=None):
        return {"submissionId": submission or str(uuid.uuid4()), "character": "sunny",
                "firstName": "QA", "email": email or f"qa-{uuid.uuid4()}@example.invalid",
                "source": "fiesta", "smsConsent": False, "marketingConsent": False}

    def submit(body, fingerprint="a"):
        # Only generated test data enters this SQL literal, never user input.
        return "select public.submit_campaign_vote('" + json.dumps(body) + "'::jsonb,repeat('" + fingerprint + "',64))"

    def race(name, first_query, second_query, expect_lock=True):
        first_name = "qa_first_" + uuid.uuid4().hex[:10]
        second_name = "qa_second_" + uuid.uuid4().hex[:10]
        first_env = {**env, "PGAPPNAME": first_name}
        second_env = {**env, "PGAPPNAME": second_name}
        first = subprocess.Popen(psql + ["-c", "set role service_role; begin; " + first_query +
                                        "; select pg_sleep(2); commit;"], stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, text=True, env=first_env, creationflags=flags)
        second = None
        try:
            deadline = time.monotonic() + 8
            while time.monotonic() < deadline:
                if sql(f"select count(*) from pg_stat_activity where application_name='{first_name}' and wait_event='PgSleep'") == "1":
                    break
                if first.poll() is not None:
                    raise RuntimeError("First race session ended before holding its transaction")
                time.sleep(0.05)
            else:
                raise RuntimeError("First race session did not reach its locked transaction")
            second = subprocess.Popen(psql + ["-c", "set role service_role; " + second_query],
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                      env=second_env, creationflags=flags)
            observed_lock = False
            if expect_lock:
                deadline = time.monotonic() + 1.5
                while time.monotonic() < deadline and second.poll() is None:
                    observed_lock = sql(f"select count(*) from pg_stat_activity where application_name='{second_name}' and wait_event_type='Lock'") == "1"
                    if observed_lock:
                        break
                    time.sleep(0.025)
                assert observed_lock, "The supposed concurrent race never waited on a real database lock"
            else:
                # SKIP LOCKED must finish while the first session still owns its rows.
                second.wait(timeout=1.5)
                assert first.poll() is None
            second_out, second_err = second.communicate(timeout=15)
            first_out, first_err = first.communicate(timeout=15)
            assert first.returncode == second.returncode == 0, first_err + second_err
            values = []
            for raw in [first_out, second_out]:
                values.append(next(json.loads(line) for line in raw.splitlines() if line.startswith(("{", "["))))
            check(name, independentSessions=True, actualLockObserved=observed_lock)
            return values
        finally:
            for proc in [second, first]:
                if proc is not None and proc.poll() is None:
                    proc.terminate()
                    proc.wait(timeout=5)

    started = False
    try:
        report["version"] = run([command("postgres"), "--version"]).strip()
        init = run([command("initdb"), "-D", str(data), "-U", "campaign_qa", "-A", "trust",
                    "--no-locale", "--encoding=UTF8"], timeout=60)
        (output / "initdb.log").write_text(init, encoding="utf-8")
        run([command("pg_ctl"), "-D", str(data), "-l", str(output / "postgres.log"), "-w", "-t", "20",
             "-o", f"-h 127.0.0.1 -p {port} -c shared_buffers=16MB -c max_connections=12", "start"])
        started = True
        sql("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon,authenticated,service_role;")
        run(psql + ["-f", str(repo / "supabase/migrations/20261122_create_campaign.sql")])
        check("Actual migration compiles and commits")
        acceptance = run(psql + ["-f", str(repo / "supabase/checks/campaign_acceptance.sql")])
        (output / "sql-acceptance.log").write_text(acceptance, encoding="utf-8")
        assert sql("select count(*) from campaign_votes") == "0"
        check("Acceptance transaction and fault-injected RPC rollback; zero retained test rows")

        assert sql("select campaign_readiness()", "service_role") == "f"
        run(psql + ["-f", str(repo / "supabase/migrations/20261115_create_rate_limits.sql")])
        check("Readiness refuses missing rate-limit dependency; actual prerequisite migration applied")
        functions = sql("select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname <> 'hit_rate_limit' order by proname").splitlines()
        assert len(functions) == 6, functions
        for role in ["anon", "authenticated"]:
            for table in ["campaign_votes", "campaign_outbox"]:
                for privilege in ["select", "insert", "update", "delete", "truncate", "references", "trigger"]:
                    assert sql(f"select has_table_privilege('{role}','public.{table}','{privilege}')") == "f"
                denied = subprocess.run(psql + ["-c", f"set role {role}; select * from public.{table}"],
                                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                        env=env, creationflags=flags, timeout=15)
                assert denied.returncode != 0 and "permission denied" in denied.stderr.lower()
                check(f"{role}: all table privileges denied and actual SELECT refused on {table}")
            for function in functions:
                assert sql(f"select has_function_privilege('{role}','{function}','execute')") == "f"
            for function_call in ["campaign_readiness()", "campaign_summary()", "submit_campaign_vote('{}'::jsonb,repeat('a',64))",
                                  "reserve_campaign_copy(gen_random_uuid(),1)", "claim_campaign_messages(null,1)",
                                  "finish_campaign_message(gen_random_uuid(),gen_random_uuid(),true,null)"]:
                denied = subprocess.run(psql + ["-c", f"set role {role}; select public.{function_call}"],
                                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                        env=env, creationflags=flags, timeout=15)
                assert denied.returncode != 0 and "permission denied" in denied.stderr.lower()
            check(f"{role}: execute denied on all six RPCs, introspected and actually attempted")

        assert sql("select campaign_readiness()", "service_role") == "t"
        assert sql("select rolbypassrls from pg_roles where rolname='service_role'") == "t"
        check("Actual service_role can execute readiness with Supabase-equivalent BYPASSRLS")
        body = request()
        saved = json.loads(sql(submit(body), "service_role"))
        assert saved["status"] == "saved"
        qa_id = saved["id"]
        assert json.loads(sql(submit(body), "service_role"))["status"] == "replay"
        assert json.loads(sql(submit(body, "b"), "service_role"))["status"] == "conflict"
        assert sql("select count(*) from campaign_votes", "service_role") == "1"
        check("Service role saves/reads through RLS; replay/conflict preserve one vote")

        body = request()
        first, second = race("Same submission: concurrent saved/replay, one vote/outbox",
                             submit(body), submit(body))
        assert {first["status"], second["status"]} == {"saved", "replay"}
        assert first["id"] == second["id"]
        assert sql(f"select count(*) from campaign_outbox where vote_id='{first['id']}'") == "1"
        email = f"duplicate-{uuid.uuid4()}@example.invalid"
        first, second = race("Same email: concurrent new IDs save/duplicate without receipt leak",
                             submit(request(email=email)), submit(request(email=email)))
        assert first["status"] == "saved" and second == {"status": "duplicate"}
        first, second = race("Concurrent reservations retain original quantity and one notice",
                             f"select public.reserve_campaign_copy('{qa_id}',2)",
                             f"select public.reserve_campaign_copy('{qa_id}',9)")
        assert first["quantity"] == second["quantity"] == 2
        assert sql(f"select count(*) from campaign_outbox where vote_id='{qa_id}' and kind='reservation'") == "1"
        first, second = race("Concurrent workers skip locked rows and claim disjoint jobs",
                             "select coalesce(jsonb_agg(x),'[]'::jsonb) from public.claim_campaign_messages(null,1) x",
                             "select coalesce(jsonb_agg(x),'[]'::jsonb) from public.claim_campaign_messages(null,1) x", False)
        assert len(first) == len(second) == 1 and first[0]["id"] != second[0]["id"]

        job = first[0]
        assert sql(f"select finish_campaign_message('{job['id']}',gen_random_uuid(),true,null)", "service_role") == "f"
        sql(f"update campaign_outbox set lease_until=now()-interval '1 second' where id='{job['id']}'")
        reclaimed = json.loads(sql(f"select jsonb_agg(x) from claim_campaign_messages('{job['voteId']}',2) x", "service_role"))
        replacement = next(row for row in reclaimed if row["id"] == job["id"])
        assert replacement["lease"] != job["lease"]
        assert sql(f"select finish_campaign_message('{job['id']}','{job['lease']}',true,null)", "service_role") == "f"
        assert sql(f"select finish_campaign_message('{job['id']}','{replacement['lease']}',true,null)", "service_role") == "t"
        check("Expired lease recovery rejects stale acknowledgements; new lease can finish")

        sql("update campaign_outbox set attempts=5,lease_token=null,lease_until=null where sent_at is null")
        assert sql("select count(*) from claim_campaign_messages(null,3)", "service_role") == "0"
        check("Exhausted jobs are not automatically reclaimed")
        revoked = json.loads(sql(submit(request()), "service_role"))["id"]
        sql(f"update campaign_votes set revoked_at=now() where id='{revoked}'")
        assert sql(f"select count(*) from claim_campaign_messages('{revoked}',2)", "service_role") == "0"
        assert json.loads(sql(f"select reserve_campaign_copy('{revoked}',2)", "service_role"))["status"] != "saved"
        check("Withdrawn votes cannot reserve or send queued messages")
        summary = json.loads(sql("select campaign_summary()", "service_role"))
        active = int(sql("select count(*) from campaign_votes where revoked_at is null"))
        assert summary["votes"] == active
        assert sum(group["votes"] for group in summary["groups"]) == active
        assert summary["reservations"] == 1
        pending = int(sql("select count(*) from campaign_outbox o join campaign_votes v on v.id=o.vote_id where o.sent_at is null and v.revoked_at is null"))
        assert summary["pendingEmails"] == pending
        check("Service-role admin summary matches actual active rows, groups, reservations and pending jobs")
        report["result"] = "passed"
    except Exception as error:
        report["result"] = "failed"
        report["error"] = str(error)
        raise
    finally:
        if started:
            run([command("pg_ctl"), "-D", str(data), "-w", "-t", "15", "-m", "fast", "stop"])
        report["ownedServerStopped"] = started
        (output / "postgres-campaign-results.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
