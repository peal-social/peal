"""The backup copy (roles/peal_backup/files/backup_copy.py): each run copies
pgBackRest's repository into the locked bucket under a prefix of its own,
writes nothing twice, never overwrites, and a run's index rebuilds the
repository as that run found it. Run against SeaweedFS, the development
stack's S3 store, in a container of the test's: a made-up repository, no
database."""

from __future__ import annotations

import datetime
import http.server
import importlib.util
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import threading
import time
from collections.abc import Callable, Iterator
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest
import yaml

from conftest import INFRA, ansible_render, role_file, settings

SCRIPT = INFRA / "roles" / "peal_backup" / "files" / "backup_copy.py"
COMPOSE = INFRA.parent.parent / "peal-docker" / "compose.yaml"
SEAWEEDFS = yaml.safe_load(COMPOSE.read_text())["services"]["seaweedfs"]["image"]

ACCESS_KEY = "synthetic-access"
SECRET_KEY = f"synthetic-secret-{secrets.token_hex(8)}"


def _load() -> ModuleType:
    spec = importlib.util.spec_from_file_location("backup_copy", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["backup_copy"] = module
    spec.loader.exec_module(module)
    return module


backup_copy = _load()


def _docker_runs() -> bool:
    return (
        shutil.which("docker") is not None
        and subprocess.run(["docker", "info"], capture_output=True, check=False).returncode == 0
    )


def _run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, capture_output=True, text=True, check=False, stdin=subprocess.DEVNULL)


@pytest.fixture(scope="module")
def endpoint() -> Iterator[str]:
    """SeaweedFS's S3 gateway, on a port of the host Docker picks."""
    name = f"peal-infra-test-{secrets.token_hex(4)}-seaweedfs"
    _run(["docker", "run", "--detach", "--name", name, "--publish", "127.0.0.1::8333",
          "--env", f"AWS_ACCESS_KEY_ID={ACCESS_KEY}", "--env", f"AWS_SECRET_ACCESS_KEY={SECRET_KEY}",
          SEAWEEDFS, "mini", "-dir=/data", "-bucket=peal-test", "-webdav=false", "-admin.ui=false",
          "-s3.port.iceberg=0", "-s3.port.lance=0",
          # Small volumes, so its disk holds one for each of the tests' buckets.
          "-master.volumeSizeLimitMB=16"]).check_returncode()
    try:
        port = _run(["docker", "port", name, "8333/tcp"]).stdout.split(":")[-1].strip()
        url = f"http://127.0.0.1:{port}"
        bucket = backup_copy.Bucket(url, "us-east-1", "peal-test", ACCESS_KEY, SECRET_KEY)
        for _ in range(120):
            try:
                list(bucket.list())
                break
            except (OSError, backup_copy.CopyError):
                time.sleep(0.5)
        else:
            pytest.fail("SeaweedFS did not start")
        yield url
    finally:
        _run(["docker", "rm", "--force", name])


def _bucket(endpoint: str) -> Any:
    bucket = backup_copy.Bucket(endpoint, "us-east-1", f"t{secrets.token_hex(6)}", ACCESS_KEY, SECRET_KEY)
    bucket.call("PUT")
    return bucket


def _put(bucket: Any, key: str, data: bytes) -> None:
    """Writes as pgBackRest does: over whatever the key held."""
    bucket.call("PUT", key, headers={"content-length": str(len(data))}, body=data)


def _get(bucket: Any, key: str) -> bytes:
    return bucket.call("GET", key)


def _contents(bucket: Any, prefix: str) -> dict[str, bytes]:
    return {key.removeprefix(prefix): _get(bucket, key) for key, _, _ in bucket.list(prefix)}


# A repository as pgBackRest lays it out under its path, with a backup
# larger than a part, so it goes in parts.
REPOSITORY = {
    "archive/peal/archive.info": b"[db]\ndb-id=1\n",
    "archive/peal/archive.info.copy": b"[db]\ndb-id=1\n",
    "archive/peal/18-1/0000000100000000/000000010000000000000001-aa.zst": b"wal one",
    "backup/peal/backup.info": b"[backup:current]\n20261122-021500F={}\n",
    "backup/peal/backup.info.copy": b"[backup:current]\n20261122-021500F={}\n",
    "backup/peal/20261122-021500F/backup.manifest": b"manifest",
    "backup/peal/20261122-021500F/bundle/1": bytes(range(256)) * 24_576,
}

# The smallest part S3 takes, but the last.
PART = 5 * 1024 * 1024


def _settings(source: Any, copy_bucket: Any, path: str = "/production", refresh_days: int = 21) -> Any:
    return backup_copy.Settings(source=source, copy=copy_bucket, path=path, refresh_days=refresh_days, part_size=PART)


def _at(hours: float) -> datetime.datetime:
    return datetime.datetime(2026, 11, 23, 2, 30, tzinfo=datetime.UTC) + datetime.timedelta(hours=hours)


@pytest.fixture
def stack(endpoint: str) -> tuple[Any, Any]:
    """A backup bucket holding the repository, and an empty copy bucket."""
    source = _bucket(endpoint)
    for key, data in REPOSITORY.items():
        _put(source, f"production/{key}", data)
    return source, _bucket(endpoint)


@pytest.mark.skipif(not _docker_runs(), reason="Docker is not running")
class TestTheCopy:
    """Against one SeaweedFS, started once for these tests in one of
    xdist's workers (conftest's scheduler runs a class in one)."""

    def test_a_first_run_copies_the_repository_then_writes_its_index(self, stack: tuple[Any, Any]) -> None:
        source, copy_bucket = stack

        run, written = backup_copy.copy(_settings(source, copy_bucket), _at(0))

        assert run == "2026-11-23T023000Z"
        assert written == len(REPOSITORY) + 1
        copied = _contents(copy_bucket, f"{run}/")
        index = json.loads(copied.pop("index.json"))
        assert copied == REPOSITORY
        assert index["objects"] == {
            key: {"copy": f"{run}/{key}", "size": len(data)} for key, data in REPOSITORY.items()
        }

    def test_a_second_run_writes_nothing(self, stack: tuple[Any, Any]) -> None:
        source, copy_bucket = stack
        backup_copy.copy(_settings(source, copy_bucket), _at(0))
        before = sorted(copy_bucket.list())

        assert backup_copy.copy(_settings(source, copy_bucket), _at(24)) == (None, 0)
        assert sorted(copy_bucket.list()) == before

    def test_a_later_run_copies_what_changed_alone_under_its_own_prefix(self, stack: tuple[Any, Any]) -> None:
        """backup.info, rewritten by the next backup, and a new segment;
        every earlier copy stays as it was, byte for byte."""
        source, copy_bucket = stack
        first, _ = backup_copy.copy(_settings(source, copy_bucket), _at(0))
        before = {key: etag for key, _, etag in copy_bucket.list()}
        _put(source, "production/backup/peal/backup.info", b"[backup:current]\n20261122-021500F={}\n20261123-021500D={}\n")
        _put(source, "production/archive/peal/18-1/0000000100000000/000000010000000000000002-bb.zst", b"wal two")
        _put(source, "production/backup/peal/20261122-021500F/backup.manifest", b"manifest")

        second, written = backup_copy.copy(_settings(source, copy_bucket), _at(24))

        assert written == 3
        assert sorted(_contents(copy_bucket, f"{second}/")) == [
            "archive/peal/18-1/0000000100000000/000000010000000000000002-bb.zst",
            "backup/peal/backup.info",
            "index.json",
        ]
        assert {key: etag for key, _, etag in copy_bucket.list() if key.startswith(f"{first}/")} == before
        index = json.loads(_get(copy_bucket, f"{second}/index.json"))
        assert index["objects"]["backup/peal/backup.info.copy"]["copy"].startswith(f"{first}/")

    def test_a_key_is_never_written_twice(self, stack: tuple[Any, Any]) -> None:
        """The store refuses a PUT on a key that exists, and a run refuses
        a prefix that holds anything."""
        source, copy_bucket = stack
        run, _ = backup_copy.copy(_settings(source, copy_bucket), _at(0))

        with pytest.raises(backup_copy.CopyError):
            copy_bucket.put_new(f"{run}/backup/peal/backup.info", b"other", 5, PART)
        _put(source, "production/backup/peal/backup.info", b"changed")
        with pytest.raises(backup_copy.CopyError, match="already holds"):
            backup_copy.copy(_settings(source, copy_bucket), _at(0))
        assert _get(copy_bucket, f"{run}/backup/peal/backup.info") == REPOSITORY["backup/peal/backup.info"]

    def test_a_run_rebuilds_the_repository_as_it_found_it(self, stack: tuple[Any, Any]) -> None:
        """The first run's set, after the repository changed and lost its
        files: complete, and as the first run found it."""
        source, copy_bucket = stack
        first, _ = backup_copy.copy(_settings(source, copy_bucket), _at(0))
        _put(source, "production/backup/peal/backup.info", b"later")
        backup_copy.copy(_settings(source, copy_bucket), _at(24))
        for key, _, _ in list(source.list("production/")):
            source.call("DELETE", key, expect=(204, 200))

        missing = backup_copy.rebuild(_settings(source, copy_bucket), first, "/production-rebuilt")

        assert missing == []
        assert _contents(source, "production-rebuilt/") == REPOSITORY
        assert backup_copy.complete_runs(copy_bucket) == [first, "2026-11-24T023000Z"]

    def test_a_rebuild_names_what_the_copy_lost(self, stack: tuple[Any, Any]) -> None:
        source, copy_bucket = stack
        run, _ = backup_copy.copy(_settings(source, copy_bucket), _at(0))
        lost = "archive/peal/18-1/0000000100000000/000000010000000000000001-aa.zst"
        copy_bucket.call("DELETE", f"{run}/{lost}", expect=(204, 200))

        assert backup_copy.rebuild(_settings(source, copy_bucket), run, "rebuilt") == [lost]

    def test_a_rebuild_never_writes_over_a_repository(self, stack: tuple[Any, Any]) -> None:
        source, copy_bucket = stack
        run, _ = backup_copy.copy(_settings(source, copy_bucket), _at(0))

        for path in ["/production", "production/", "/"]:
            with pytest.raises(backup_copy.CopyError, match="new path"):
                backup_copy.rebuild(_settings(source, copy_bucket), run, path)
        _put(source, "taken/backup/peal/backup.info", b"someone's")
        with pytest.raises(backup_copy.CopyError, match="already holds"):
            backup_copy.rebuild(_settings(source, copy_bucket), run, "taken")

    def test_files_the_copy_holds_from_long_ago_are_copied_again(self, stack: tuple[Any, Any]) -> None:
        """Before the copy's lifecycle rule deletes them: a file older in
        the copy than the refresh is copied anew."""
        source, copy_bucket = stack
        backup_copy.copy(_settings(source, copy_bucket, refresh_days=21), _at(0))

        assert backup_copy.copy(_settings(source, copy_bucket, refresh_days=21), _at(24 * 20))[1] == 0
        run, written = backup_copy.copy(_settings(source, copy_bucket, refresh_days=21), _at(24 * 22))
        assert written == len(REPOSITORY) + 1
        assert _contents(copy_bucket, f"{run}/").keys() - {"index.json"} == REPOSITORY.keys()

    def test_the_command_reads_its_keys_from_the_file_and_reports(
        self, stack: tuple[Any, Any], tmp_path: Path, endpoint: str
    ) -> None:
        """The keys by name from credentials.env, never printed; a success
        and a failure each posted to the collector."""
        source, copy_bucket = stack
        credentials = tmp_path / "credentials.env"
        credentials.write_text(
            f"PGBACKREST_REPO1_S3_KEY='{ACCESS_KEY}'\nPGBACKREST_REPO1_S3_KEY_SECRET='{SECRET_KEY}'\n"
            f"PEAL_BACKUP_COPY_S3_ACCESS_KEY_ID={ACCESS_KEY}\nPEAL_BACKUP_COPY_S3_SECRET_ACCESS_KEY={SECRET_KEY}\n"
            "RESEND_API_KEY='re_synthetic'\n"
        )
        posts: list[str] = []

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self) -> None:
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                posts.append(body["resourceMetrics"][0]["scopeMetrics"][0]["metrics"][0]["name"])
                self.send_response(200)
                self.send_header("Content-Length", "0")
                self.end_headers()

            def log_message(self, *_: object) -> None:
                pass

        collector = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=collector.serve_forever, daemon=True).start()
        environ = {
            "PEAL_BACKUP_COPY_CREDENTIALS": str(credentials),
            "PEAL_BACKUP_COPY_ENDPOINT": endpoint,
            "PEAL_BACKUP_COPY_REGION": "us-east-1",
            "PEAL_BACKUP_COPY_SOURCE_BUCKET": source.name,
            "PEAL_BACKUP_COPY_SOURCE_PATH": "/production",
            "PEAL_BACKUP_COPY_BUCKET": copy_bucket.name,
            "PEAL_BACKUP_COPY_OTLP_URL": f"http://127.0.0.1:{collector.server_address[1]}/v1/metrics",
            "PEAL_BACKUP_COPY_REPORT_RETRIES": "0",
        }
        try:
            ran = subprocess.run([sys.executable, str(SCRIPT), "copy"], env=environ,
                                 capture_output=True, text=True, check=False)
            failed = subprocess.run([sys.executable, str(SCRIPT), "copy"],
                                    env={**environ, "PEAL_BACKUP_COPY_BUCKET": "no-such-bucket"},
                                    capture_output=True, text=True, check=False)
        finally:
            collector.shutdown()
            collector.server_close()

        assert ran.returncode == 0, ran.stderr
        assert failed.returncode == 1
        assert SECRET_KEY not in ran.stdout + ran.stderr + failed.stdout + failed.stderr
        assert posts == ["peal_backup_copy_last_success_timestamp", "peal_backup_copy_last_failure_timestamp"]


def test_a_missing_key_is_named_and_stops_the_run(tmp_path: Path) -> None:
    credentials = tmp_path / "credentials.env"
    credentials.write_text("PGBACKREST_REPO1_S3_KEY=synthetic\nPGBACKREST_REPO1_S3_KEY_SECRET=synthetic\n")

    with pytest.raises(backup_copy.CopyError, match="PEAL_BACKUP_COPY_S3_ACCESS_KEY_ID"):
        backup_copy.settings_from({
            "PEAL_BACKUP_COPY_CREDENTIALS": str(credentials),
            "PEAL_BACKUP_COPY_ENDPOINT": "https://example.test",
            "PEAL_BACKUP_COPY_SOURCE_BUCKET": "synthetic",
            "PEAL_BACKUP_COPY_SOURCE_PATH": "/production",
            "PEAL_BACKUP_COPY_BUCKET": "synthetic-copy",
        })


# The role (roles/peal_backup): nothing of the copy without the flag, and
# with it, the units that run it after each backup and daily.
ENVIRONMENTS = ["peal-production", "peal-sandbox"]
COPY = {"peal_backup_copy": True, "peal_backup_copy_bucket": "peal-synthetic-backup-copy"}


@pytest.fixture(scope="module")
def rendered_copy(rendered_with: Callable[..., Path]) -> Path:
    return rendered_with(**COPY)


@pytest.mark.parametrize("environment", ENVIRONMENTS)
def test_without_the_flag_the_backup_s_units_stay_as_they_were(rendered: Path, environment: str) -> None:
    service = (rendered / environment / "peal-backup@.service").read_text()

    assert "OnSuccess" not in service
    assert not (rendered / environment / "peal-backup-copy.service").exists()


@pytest.mark.parametrize("environment", ENVIRONMENTS)
def test_the_copy_runs_after_each_backup_and_daily(rendered_copy: Path, environment: str) -> None:
    folder = rendered_copy / environment
    group = settings(environment.removeprefix("peal-"))

    assert "OnSuccess=peal-backup-copy.service" in (folder / "peal-backup@.service").read_text()
    assert "Unit=peal-backup-copy.service" in (folder / "peal-backup-copy.timer").read_text()
    service = (folder / "peal-backup-copy.service").read_text()
    environ = dict(
        line.removeprefix("Environment=").split("=", 1)
        for line in service.splitlines() if line.startswith("Environment=")
    )
    assert environ["PEAL_BACKUP_COPY_ENDPOINT"] == f"https://{group['peal_backup_endpoint']}"
    assert environ["PEAL_BACKUP_COPY_SOURCE_BUCKET"] == group["peal_backup_bucket"]
    assert environ["PEAL_BACKUP_COPY_SOURCE_PATH"] == group["peal_backup_path"]
    assert environ["PEAL_BACKUP_COPY_BUCKET"] == "peal-synthetic-backup-copy"
    assert environ["PEAL_BACKUP_COPY_CREDENTIALS"] == "/srv/peal/credentials.env"
    # Settings alone: the keys stay in the credentials file.
    assert not [name for name in environ if "KEY" in name or "SECRET" in name]
    # Under the backups' lock, so never while pgBackRest rewrites its files.
    assert "ExecStart=/usr/bin/flock /run/peal-backup.lock " in service


def test_the_role_installs_the_copy_only_with_the_flag() -> None:
    tasks = yaml.safe_load((INFRA / "roles" / "peal_backup" / "tasks" / "main.yml").read_text())
    blocks = {found["name"]: found for found in tasks if "block" in found}

    assert blocks["Install and start the backup copy"]["when"] == "peal_backup_copy | bool"
    assert blocks["Remove the backup copy"]["when"] == "not peal_backup_copy | bool"


@pytest.mark.parametrize("environment", ["production", "sandbox"])
def test_the_flag_requires_the_copy_s_key(environment: str) -> None:
    expression = role_file("peal_runtime", "vars")["peal_runtime_required_credentials"]
    names = settings(environment)
    keys = {"PEAL_BACKUP_COPY_S3_ACCESS_KEY_ID", "PEAL_BACKUP_COPY_S3_SECRET_ACCESS_KEY"}

    assert keys <= set(ansible_render(expression, **{**names, **COPY}))
    assert not keys & set(ansible_render(expression, **names))


def test_the_preflight_refuses_the_flag_without_the_bucket() -> None:
    found = next(
        item for item in yaml.safe_load((INFRA / "roles" / "peal_preflight" / "tasks" / "main.yml").read_text())
        if item["name"] == "Refuse a backup copy without its bucket"
    )
    holds = found["ansible.builtin.assert"]["that"]
    production = settings("production")

    assert ansible_render("{{ " + holds + " }}", **production) is True
    assert ansible_render("{{ " + holds + " }}", **{**production, **COPY}) is True
    assert ansible_render("{{ " + holds + " }}", **{**production, "peal_backup_copy": True}) is False


def test_the_lock_and_the_refresh_agree_with_the_bucket_s_rules() -> None:
    """The role's lock days are the Pulumi stack's; a file is copied again
    before the lifecycle rule deletes its copy; the lock outlasts a week of
    backups, so the newest full backup is always locked."""
    source = (INFRA.parent / "pulumi" / "src" / "environment.ts").read_text()
    lock = int(re.search(r"backupCopyLockDays = (\d+);", source).group(1))  # type: ignore[union-attr]
    retention = int(re.search(r"backupCopyRetentionDays = (\d+);", source).group(1))  # type: ignore[union-attr]
    defaults = role_file("peal_backup", "defaults")

    assert defaults["peal_backup_copy_lock_days"] == lock
    assert 7 < lock < defaults["peal_backup_copy_refresh_days"] < retention


# Grafana's rules on the copy (peal-docker's rules.yaml), on the gauges the
# script posts, which Prometheus names with their unit.
RULES = INFRA.parent.parent / "peal-docker" / "config" / "production" / "grafana" / "alerting" / "rules.yaml"
SUCCESS = "peal_backup_copy_last_success_timestamp_seconds"
FAILURE = "peal_backup_copy_last_failure_timestamp_seconds"
BACKUP = "peal_backup_last_success_timestamp_seconds"


def _rule(uid: str) -> dict[str, Any]:
    [group] = yaml.safe_load(RULES.read_text())["groups"]
    [found] = [rule for rule in group["rules"] if rule["uid"] == uid]
    return found


def _query(uid: str) -> str:
    [query] = [step["model"]["expr"] for step in _rule(uid)["data"] if step["refId"] == "A"]
    return query


def test_the_script_posts_the_gauges_the_rules_read() -> None:
    posted = set(re.findall(r'"(peal_backup_copy_\w+)"', SCRIPT.read_text()))

    assert posted == {"peal_backup_copy_last_success_timestamp", "peal_backup_copy_last_failure_timestamp"}
    assert {SUCCESS, FAILURE} <= set(re.findall(r"peal_backup_copy_\w+", _query("peal-backup-copy-failed")))
    assert {SUCCESS, BACKUP} <= set(re.findall(r"peal_backup\w+", _query("peal-backup-copy-behind")))
    for uid in ["peal-backup-copy-failed", "peal-backup-copy-behind"]:
        # A server without the copy posts none of its gauges.
        assert (_rule(uid)["noDataState"], _rule(uid)["labels"]) == ("OK", {"severity": "critical"})


def _prometheus_image() -> str:
    compose = yaml.safe_load((INFRA.parent.parent / "peal-docker" / "compose.production.yaml").read_text())
    return compose["services"]["prometheus"]["image"]


# Each rule as Prometheus evaluates it, on made-up series, one sample a
# minute, each the time a gauge reports, in seconds.
PROMTOOL_TESTS = [
    ("failure after a copy", "peal-backup-copy-failed", 0,
     {SUCCESS: "100x20", FAILURE: "_x9 700x10"}, [(5, False), (15, True)]),
    ("a copy after a failure", "peal-backup-copy-failed", 0,
     {FAILURE: "100x20", SUCCESS: "_x9 700x10"}, [(5, True), (15, False)]),
    ("never failed", "peal-backup-copy-failed", 0, {SUCCESS: "100x20"}, [(15, False)]),
    ("no copy at all", "peal-backup-copy-failed", 0, {BACKUP: "100x20"}, [(15, False)]),
    ("a copy after each backup", "peal-backup-copy-behind", 21600,
     {BACKUP: "1000x20", SUCCESS: "1100x20"}, [(15, False)]),
    ("a backup the copy missed", "peal-backup-copy-behind", 21600,
     {BACKUP: "1000x9 30000x10", SUCCESS: "1100x20"}, [(5, False), (15, True)]),
    ("a server without the copy", "peal-backup-copy-behind", 21600, {BACKUP: "1000x20"}, [(15, False)]),
]


@pytest.mark.skipif(not _docker_runs(), reason="Docker is not running")
def test_the_rules_fire_as_they_say(tmp_path: Path) -> None:
    rules = [
        {"alert": uid, "expr": f"({_query(uid)}) > {threshold}"}
        for uid, threshold in {(uid, threshold) for _, uid, threshold, _, _ in PROMTOOL_TESTS}
    ]
    (tmp_path / "rules.yml").write_text(yaml.safe_dump({"groups": [{"name": "copy", "rules": rules}]}))
    tests = [
        {
            "name": name,
            "interval": "1m",
            "input_series": [{"series": series, "values": values} for series, values in inputs.items()],
            "alert_rule_test": [
                {"eval_time": f"{minute}m", "alertname": uid, "exp_alerts": [{"exp_labels": {}}] if fires else []}
                for minute, fires in expected
            ],
        }
        for name, uid, _, inputs, expected in PROMTOOL_TESTS
    ]
    (tmp_path / "tests.yml").write_text(yaml.safe_dump({"rule_files": ["rules.yml"], "evaluation_interval": "1m", "tests": tests}))

    ran = subprocess.run(
        ["docker", "run", "--rm", "--user", f"{os.getuid()}:{os.getgid()}",
         "--volume", f"{tmp_path}:/w:ro", "--workdir", "/w", "--entrypoint", "promtool",
         _prometheus_image(), "test", "rules", "tests.yml"],
        capture_output=True, text=True, check=False, stdin=subprocess.DEVNULL,
    )

    assert ran.returncode == 0, ran.stdout + ran.stderr
