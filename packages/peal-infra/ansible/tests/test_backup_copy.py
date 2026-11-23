"""The backup copy (roles/peal_backup/files/backup_copy.py): each run copies
pgBackRest's repository into the locked bucket under a prefix of its own,
writes nothing twice, never overwrites, and a run's index rebuilds the
repository as that run found it. Run against SeaweedFS, the development
stack's S3 store, in a container of the test's: a made-up repository, no
database."""

from __future__ import annotations

import contextlib
import dataclasses
import datetime
import hashlib
import http.client
import http.server
import importlib.util
import io
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import threading
import tracemalloc
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
    # Its data in memory, whatever Docker's disk has left, in small
    # volumes and enough of them for each of the tests' buckets: it sizes
    # their number by the free space otherwise.
    _run(["docker", "run", "--detach", "--name", name, "--publish", "127.0.0.1::8333",
          "--tmpfs", "/data:size=1g",
          "--env", f"AWS_ACCESS_KEY_ID={ACCESS_KEY}", "--env", f"AWS_SECRET_ACCESS_KEY={SECRET_KEY}",
          SEAWEEDFS, "mini", "-dir=/data", "-bucket=peal-test", "-webdav=false", "-admin.ui=false",
          "-s3.port.iceberg=0", "-s3.port.lance=0", "-master.volumeSizeLimitMB=8", "-volume.max=200"]).check_returncode()
    try:
        port = _run(["docker", "port", name, "8333/tcp"]).stdout.split(":")[-1].strip()
        url = f"http://127.0.0.1:{port}"
        bucket = backup_copy.Bucket(url, "us-east-1", "peal-test", ACCESS_KEY, SECRET_KEY)
        # Three minutes: a loaded machine takes its time to start a store.
        for _ in range(360):
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


def _contents(bucket: Any, prefix: str) -> dict[str, bytes]:
    return {key.removeprefix(prefix): bucket.get(key) for key, _ in bucket.list(prefix)}


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


def _settings(source: Any, copy_bucket: Any, path: str = "/production") -> Any:
    return backup_copy.Settings(source=source, copy=copy_bucket, path=path, refresh_days=21, part_size=PART,
                                lock_days=35, max_run_hours=12)


def _later() -> datetime.datetime:
    """A run's time: the store's clock decides, so a run is named now, a
    second after the last one, which has a name of its own."""
    time.sleep(1.1)
    return datetime.datetime.now(datetime.UTC)


SOON = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=1)


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
    xdist's workers (conftest's scheduler runs a class in one): the S3
    calls as R2 takes them, the store's own times, parts, and keys it
    refuses to write twice."""

    def test_a_first_run_copies_the_repository_then_writes_its_index(self, stack: tuple[Any, Any]) -> None:
        source, copy_bucket = stack

        run, written = backup_copy.copy(_settings(source, copy_bucket), _later())

        assert written == len(REPOSITORY) + 1
        copied = _contents(copy_bucket, f"{run}/")
        index = json.loads(copied.pop("index.json"))
        assert copied == REPOSITORY
        assert index["objects"] == {
            key: {
                "copy": f"{run}/{key}",
                "sha256": hashlib.sha256(data).hexdigest(),
                "size": len(data),
                "source_etag": hashlib.md5(data, usedforsecurity=False).hexdigest(),
            }
            for key, data in REPOSITORY.items()
        }

    def test_a_second_run_writes_nothing(self, stack: tuple[Any, Any]) -> None:
        source, copy_bucket = stack
        backup_copy.copy(_settings(source, copy_bucket), _later())
        before = sorted(key for key, _ in copy_bucket.list())

        assert backup_copy.copy(_settings(source, copy_bucket), _later()) == (None, 0)
        assert sorted(key for key, _ in copy_bucket.list()) == before

    def test_a_later_run_copies_what_changed_alone(self, stack: tuple[Any, Any]) -> None:
        """backup.info, rewritten by the next backup, and a new segment;
        every earlier copy stays as it was, byte for byte."""
        source, copy_bucket = stack
        first, _ = backup_copy.copy(_settings(source, copy_bucket), _later())
        before = {key: stored for key, stored in copy_bucket.list()}
        _put(source, "production/backup/peal/backup.info", b"[backup:current]\n20261123-021500D={}\n")
        _put(source, "production/archive/peal/18-1/0000000100000000/000000010000000000000002-bb.zst", b"wal two")
        _put(source, "production/backup/peal/20261122-021500F/backup.manifest", b"manifest")

        second, written = backup_copy.copy(_settings(source, copy_bucket), _later())

        assert written == 3
        assert sorted(_contents(copy_bucket, f"{second}/")) == [
            "archive/peal/18-1/0000000100000000/000000010000000000000002-bb.zst",
            "backup/peal/backup.info",
            "index.json",
        ]
        assert {key: stored for key, stored in copy_bucket.list() if key.startswith(f"{first}/")} == before

    def test_a_key_is_never_written_twice(self, stack: tuple[Any, Any]) -> None:
        source, copy_bucket = stack
        run, _ = backup_copy.copy(_settings(source, copy_bucket), _later())

        with pytest.raises(backup_copy.CopyError):
            copy_bucket.put_new(f"{run}/backup/peal/backup.info", b"other", 5, PART)
        assert copy_bucket.get(f"{run}/backup/peal/backup.info") == REPOSITORY["backup/peal/backup.info"]

    def test_a_run_rebuilds_the_repository_as_it_found_it(self, stack: tuple[Any, Any]) -> None:
        """The first run's set, after the repository changed and lost its
        files: complete, checked, and as the first run found it."""
        source, copy_bucket = stack
        first, _ = backup_copy.copy(_settings(source, copy_bucket), _later())
        _put(source, "production/backup/peal/backup.info", b"later")
        second, _ = backup_copy.copy(_settings(source, copy_bucket), _later())
        for key, _ in list(source.list("production/")):
            source.call("DELETE", key, expect=(204, 200))

        missing = backup_copy.rebuild(_settings(source, copy_bucket), first, "/production-rebuilt", SOON)

        assert missing == []
        assert _contents(source, "production-rebuilt/") == REPOSITORY
        lines = backup_copy.describe_runs(_settings(source, copy_bucket))
        assert [line.split()[0] for line in lines] == [first, second]
        assert all("all locked until" in line for line in lines)

    def test_a_rebuild_names_what_the_copy_lost(self, stack: tuple[Any, Any]) -> None:
        source, copy_bucket = stack
        run, _ = backup_copy.copy(_settings(source, copy_bucket), _later())
        lost = "archive/peal/18-1/0000000100000000/000000010000000000000001-aa.zst"
        copy_bucket.call("DELETE", f"{run}/{lost}", expect=(204, 200))

        assert backup_copy.rebuild(_settings(source, copy_bucket), run, "rebuilt", SOON) == [lost]

    def test_a_rebuild_never_writes_over_a_repository(self, stack: tuple[Any, Any]) -> None:
        source, copy_bucket = stack
        run, _ = backup_copy.copy(_settings(source, copy_bucket), _later())

        for path in ["/production", "production/", "/"]:
            with pytest.raises(backup_copy.CopyError, match="new path"):
                backup_copy.rebuild(_settings(source, copy_bucket), run, path, SOON)
        _put(source, "taken/backup/peal/backup.info", b"someone's")
        with pytest.raises(backup_copy.CopyError, match="already holds"):
            backup_copy.rebuild(_settings(source, copy_bucket), run, "taken", SOON)

    def test_a_run_named_in_the_past_by_its_writer_is_not_trusted(self, stack: tuple[Any, Any]) -> None:
        """Whoever holds the server writes a run named before the incident:
        the store's time for its index gives it away."""
        source, copy_bucket = stack
        honest, _ = backup_copy.copy(_settings(source, copy_bucket), _later())
        forged = "2026-11-01T021500Z"
        for key, data in REPOSITORY.items():
            copy_bucket.put_new(f"{forged}/{key}", data, len(data), PART)
        index = json.dumps({"objects": {
            key: {"copy": f"{forged}/{key}", "sha256": hashlib.sha256(data).hexdigest(), "size": len(data)}
            for key, data in REPOSITORY.items()
        }}).encode()
        copy_bucket.put_new(f"{forged}/index.json", index, len(index), PART)

        with pytest.raises(backup_copy.CopyError, match="not trusted"):
            backup_copy.rebuild(_settings(source, copy_bucket), forged, "rebuilt", SOON)
        assert any(line.startswith(f"{forged}  ") and "NOT TRUSTED" in line
                   for line in backup_copy.describe_runs(_settings(source, copy_bucket)))
        # Nor does the next run take it for the newest.
        assert backup_copy.copy(_settings(source, copy_bucket), _later()) == (None, 0)
        assert honest

    def test_keys_with_control_characters_stop_nothing(self, stack: tuple[Any, Any]) -> None:
        """Listed URL-encoded, a key's control characters never reach the
        XML parser; a key that is an index but for a trailing newline, or
        names a year out of range, is no trusted run."""
        source, copy_bucket = stack
        honest, _ = backup_copy.copy(_settings(source, copy_bucket), _later())
        for key in ["2026-11-01T000000Z/index.json\n", "2026-11-01T000000Z/\x01\x1b[2J", "0001-01-01T000000Z/index.json"]:
            _put(copy_bucket, key, b"x")

        assert backup_copy.copy(_settings(source, copy_bucket), _later()) == (None, 0)
        lines = list(backup_copy.describe_runs(_settings(source, copy_bucket)))
        assert [line.split()[0] for line in lines] == ["0001-01-01T000000Z", honest]
        assert "out of range" in lines[0]
        assert backup_copy.rebuild(_settings(source, copy_bucket), honest, "rebuilt", SOON) == []

    def test_the_command_reads_its_keys_from_the_file_and_reports(
        self, stack: tuple[Any, Any], tmp_path: Path, endpoint: str
    ) -> None:
        """The keys by name from the credentials, never printed; a success
        and a failure each posted to the collector."""
        source, copy_bucket = stack
        credentials = tmp_path / "credentials"
        credentials.write_text(
            f"PGBACKREST_REPO1_S3_KEY='{ACCESS_KEY}'\nPGBACKREST_REPO1_S3_KEY_SECRET='{SECRET_KEY}'\n"
            f"PEAL_BACKUP_COPY_S3_ACCESS_KEY_ID={ACCESS_KEY}\nPEAL_BACKUP_COPY_S3_SECRET_ACCESS_KEY={SECRET_KEY}\n"
            "RESEND_API_KEY='re_synthetic'\n"
        )
        with _collector() as (url, posts):
            environ = {
                "PEAL_BACKUP_COPY_CREDENTIALS": str(credentials),
                "PEAL_BACKUP_COPY_ENDPOINT": endpoint,
                "PEAL_BACKUP_COPY_REGION": "us-east-1",
                "PEAL_BACKUP_COPY_SOURCE_BUCKET": source.name,
                "PEAL_BACKUP_COPY_SOURCE_PATH": "/production",
                "PEAL_BACKUP_COPY_BUCKET": copy_bucket.name,
                "PEAL_BACKUP_COPY_OTLP_URL": url,
                "PEAL_BACKUP_COPY_REPORT_RETRIES": "0",
            }
            ran = subprocess.run([sys.executable, str(SCRIPT), "copy"], env=environ,
                                 capture_output=True, text=True, check=False)
            failed = subprocess.run([sys.executable, str(SCRIPT), "copy"],
                                    env={**environ, "PEAL_BACKUP_COPY_BUCKET": "no-such-bucket"},
                                    capture_output=True, text=True, check=False)

        assert ran.returncode == 0, ran.stderr
        assert failed.returncode == 1
        assert "Traceback" not in failed.stderr
        assert SECRET_KEY not in ran.stdout + ran.stderr + failed.stdout + failed.stderr
        assert posts == ["peal_backup_copy_last_success_timestamp", "peal_backup_copy_last_failure_timestamp"]


@contextlib.contextmanager
def _collector() -> Iterator[tuple[str, list[str]]]:
    """A collector's OTLP receiver on 127.0.0.1: the names of the gauges
    posted to it."""
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

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}/v1/metrics", posts
    finally:
        server.shutdown()
        server.server_close()


# The copy's rules over time, on a store of the test's whose clock the test
# sets: its lock refuses to delete or overwrite what it wrote less than the
# lock's days ago, and its lifecycle deletes what is older than 49 days.

DAY = datetime.timedelta(days=1)
START = datetime.datetime(2027, 1, 3, 2, 15, tzinfo=datetime.UTC)  # A Sunday.
LOCK_DAYS = 35
RETENTION_DAYS = 49


class FakeStore:
    """A bucket, with the store's clock, a lock and a lifecycle rule."""

    def __init__(self, name: str, clock: list[datetime.datetime], lock_days: int = 0) -> None:
        self.name = name
        self.clock = clock
        self.lock = datetime.timedelta(days=lock_days)
        self.objects: dict[str, tuple[bytes, datetime.datetime]] = {}
        self.listings = 0
        self.gets = 0

    def list(self, prefix: str = "", limit: int | None = None) -> Iterator[tuple[str, Any]]:
        self.listings += 1
        for count, key in enumerate(key for key in sorted(self.objects) if key.startswith(prefix)):
            if limit is not None and count >= limit:
                return
            yield key, self._stored(key)

    def _stored(self, key: str) -> Any:
        data, modified = self.objects[key]
        return backup_copy.Stored(len(data), hashlib.md5(data, usedforsecurity=False).hexdigest(), modified)

    def stat(self, key: str) -> Any:
        return self._stored(key) if key in self.objects else None

    def now(self) -> datetime.datetime:
        return self.clock[0]

    def get(self, key: str) -> bytes:
        self.gets += 1
        if key not in self.objects:
            raise backup_copy.StoreError(f"no {key}", 404)
        return self.objects[key][0]

    def open(self, key: str) -> tuple[int, str, Any]:
        data = self.get(key)
        return len(data), hashlib.md5(data, usedforsecurity=False).hexdigest(), io.BytesIO(data)

    def put_new(self, key: str, body: Any, size: int, part_size: int) -> str:
        if key in self.objects:
            raise backup_copy.CopyError(f"{key} exists")
        data = body if isinstance(body, bytes) else body.read(size)
        self.objects[key] = (data, self.clock[0])
        return hashlib.md5(data, usedforsecurity=False).hexdigest()

    def write(self, key: str, data: bytes) -> None:
        """Writes over a key, as pgBackRest does, or as whoever holds a key
        tries to: the lock refuses a locked one."""
        if key in self.objects and self.clock[0] - self.objects[key][1] < self.lock:
            raise backup_copy.CopyError(f"{key} is locked")
        self.objects[key] = (data, self.clock[0])

    def delete(self, key: str) -> None:
        if self.clock[0] - self.objects[key][1] < self.lock:
            raise backup_copy.CopyError(f"{key} is locked")
        del self.objects[key]

    def expire(self, days: int) -> None:
        for key, (_, modified) in list(self.objects.items()):
            if self.clock[0] - modified > datetime.timedelta(days=days):
                del self.objects[key]


def _fake(lock_days: int = LOCK_DAYS) -> tuple[Any, Any, list[datetime.datetime]]:
    clock = [START]
    source, copy_bucket = FakeStore("backups", clock), FakeStore("copy", clock, lock_days)
    for key, data in REPOSITORY.items():
        source.write(f"production/{key}", data)
    return source, copy_bucket, clock


def _fake_settings(source: Any, copy_bucket: Any) -> Any:
    return backup_copy.Settings(source=source, copy=copy_bucket, path="/production", refresh_days=21,
                                part_size=PART, lock_days=LOCK_DAYS, max_run_hours=12)


def _latest_index(copy_bucket: Any, now: datetime.datetime) -> tuple[Any, dict[str, Any]]:
    """The newest run the copy trusts, and the files its index names."""
    settings = _fake_settings(copy_bucket, copy_bucket)
    newest = backup_copy.newest_trusted(backup_copy.runs(settings, now))[0]
    return newest, json.loads(copy_bucket.get(f"{newest.name}/index.json"))["objects"]


def test_the_newest_index_is_always_locked_over_two_months() -> None:
    """Sixty days of pgBackRest as Peal runs it: a full backup each Sunday,
    a differential one the other days, a segment of the write-ahead log
    each hour, four full backups kept, and archive.info, which the WAL's
    decryption needs, written once. After each day's copy, every file the
    newest index names has a copy the lock keeps for 14 days more at least;
    and whatever stops the copy, the newest index stays whole and locked
    for 14 days."""
    source, copy_bucket, clock = _fake()
    fulls: list[str] = []
    for day in range(60):
        clock[0] = START + day * DAY
        label = f"{clock[0]:%Y%m%d-%H%M%S}{'F' if clock[0].weekday() == 6 else 'D'}"
        if label.endswith("F"):
            fulls.append(label)
        source.write(f"production/backup/peal/{label}/backup.manifest", label.encode())
        source.write(f"production/backup/peal/{label}/bundle/1", label.encode() * 100)
        for hour in range(24):
            source.write(f"production/archive/peal/18-1/{day:08d}/{hour:024d}.zst", f"wal {day} {hour}".encode())
        source.write("production/backup/peal/backup.info", f"[backup:current]\n{label}={{}}\n".encode())
        source.write("production/backup/peal/backup.info.copy", f"[backup:current]\n{label}={{}}\n".encode())
        # Four full backups kept: the oldest expires with what it needs.
        if len(fulls) > 4:
            expired = fulls.pop(0)
            for key in [key for key, _ in source.list("production/backup/peal/") if expired[:8] <= key.split("/")[3][:8] < fulls[0][:8]]:
                del source.objects[key]
        copy_bucket.expire(RETENTION_DAYS)

        backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])

        newest, objects = _latest_index(copy_bucket, clock[0])
        listing = dict(copy_bucket.list())
        assert objects.keys() == {key.removeprefix("production/") for key, _ in source.list("production/")}
        stored = [listing[entry["copy"]].modified for entry in objects.values()] + [newest.stored]
        # Locked for 14 days more at least, everything the newest index names.
        assert min(stored) + datetime.timedelta(days=LOCK_DAYS) >= clock[0] + datetime.timedelta(days=14), day

    # The server is taken: whoever holds it deletes all it can, every day,
    # for 14 days, and writes nothing the copy trusts.
    taken = clock[0]
    newest, objects = _latest_index(copy_bucket, taken)
    for day in range(1, 15):
        clock[0] = taken + day * DAY - datetime.timedelta(minutes=1)
        for key in list(copy_bucket.objects):
            with contextlib.suppress(backup_copy.CopyError):
                copy_bucket.delete(key)
        copy_bucket.expire(RETENTION_DAYS)
        assert all(entry["copy"] in copy_bucket.objects for entry in objects.values()), day
        assert f"{newest.name}/index.json" in copy_bucket.objects


def test_archive_info_written_once_stays_in_every_index_and_locked() -> None:
    """The file that holds the WAL's key: never rewritten in the
    repository, copied again before its copy leaves the lock."""
    source, copy_bucket, clock = _fake()
    for day in range(70):
        clock[0] = START + day * DAY
        source.write("production/backup/peal/backup.info", f"day {day}".encode())
        backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])
        _, objects = _latest_index(copy_bucket, clock[0])
        entry = objects["archive/peal/archive.info"]
        age = clock[0] - dict(copy_bucket.list())[entry["copy"]].modified
        assert age <= datetime.timedelta(days=21), day


def test_a_quiet_repository_still_gets_a_fresh_index() -> None:
    """Nothing changes for weeks: the newest index is written again before
    it, and what it names, leave the lock."""
    source, copy_bucket, clock = _fake()
    runs = []
    for day in range(50):
        clock[0] = START + day * DAY
        run, _ = backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])
        if run:
            runs.append(day)

    assert runs == [0, 21, 42]


def test_a_run_named_in_the_future_or_long_after_is_ignored() -> None:
    """An index named later than now, or stored long after its name: the
    next run takes neither for the newest, and copies afresh."""
    source, copy_bucket, clock = _fake()
    honest, _ = backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])
    clock[0] += DAY
    forged = f"{clock[0] + 3 * DAY:%Y-%m-%dT%H%M%S}Z"
    copy_bucket.put_new(f"{forged}/index.json", b'{"objects": {}}', 15, PART)
    late = f"{clock[0] - 2 * DAY:%Y-%m-%dT%H%M%S}Z"
    copy_bucket.put_new(f"{late}/index.json", b'{"objects": {}}', 15, PART)

    runs = list(backup_copy.runs(_fake_settings(source, copy_bucket), clock[0]))

    assert {run.name: run.trusted for run in runs} == {
        honest: True, forged: False, late: False,
    }
    assert backup_copy.copy(_fake_settings(source, copy_bucket), clock[0]) == (None, 0)


def test_a_rebuild_refuses_what_was_written_at_or_after_the_incident() -> None:
    source, copy_bucket, clock = _fake(lock_days=0)
    run, _ = backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])
    incident = clock[0] + DAY
    clock[0] += 2 * DAY

    # The index is older than the incident: it rebuilds.
    assert backup_copy.rebuild(_fake_settings(source, copy_bucket), run, "rebuilt", incident) == []
    # Not before the incident, by the store's clock.
    with pytest.raises(backup_copy.CopyError, match="not before"):
        backup_copy.rebuild(_fake_settings(source, copy_bucket), run, "again", START)
    # A copy deleted and written again, unlocked, after the index.
    key = "archive/peal/archive.info"
    copy_bucket.delete(f"{run}/{key}")
    copy_bucket.put_new(f"{run}/{key}", REPOSITORY[key], len(REPOSITORY[key]), PART)
    with pytest.raises(backup_copy.CopyError, match="written after"):
        backup_copy.rebuild(_fake_settings(source, copy_bucket), run, "third", incident)
    assert not list(source.list("third/"))


def test_a_rebuild_checks_each_copy_s_bytes() -> None:
    """A copy whose bytes changed, its size kept and its time too (a store
    that went wrong): the rebuild stops on its SHA-256."""
    source, copy_bucket, clock = _fake(lock_days=0)
    run, _ = backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])
    key = f"{run}/backup/peal/20261122-021500F/backup.manifest"
    data, modified = copy_bucket.objects[key]
    copy_bucket.objects[key] = (b"X" * len(data), modified)

    with pytest.raises(backup_copy.CopyError, match="does not hold"):
        backup_copy.rebuild(_fake_settings(source, copy_bucket), run, "rebuilt", START + DAY)


def test_a_copy_that_reads_back_wrong_stops_the_run() -> None:
    """The source's ETag is the MD5 of its bytes: a read that differs
    stops the run before its index."""
    source, copy_bucket, clock = _fake()

    class Garbled(FakeStore):
        def open(self, key: str) -> tuple[int, str, Any]:
            data = self.get(key)
            return len(data), hashlib.md5(data, usedforsecurity=False).hexdigest(), io.BytesIO(b"Y" * len(data))

    garbled = Garbled("backups", clock)
    garbled.objects = source.objects

    with pytest.raises(backup_copy.CopyError, match="did not read back"):
        backup_copy.copy(_fake_settings(garbled, copy_bucket), clock[0])
    assert not [key for key in copy_bucket.objects if key.endswith("index.json")]


def test_any_failure_is_reported_never_a_bare_traceback(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    credentials = tmp_path / "credentials"
    credentials.write_text(
        "PGBACKREST_REPO1_S3_KEY=synthetic\nPGBACKREST_REPO1_S3_KEY_SECRET=synthetic\n"
        "PEAL_BACKUP_COPY_S3_ACCESS_KEY_ID=synthetic\nPEAL_BACKUP_COPY_S3_SECRET_ACCESS_KEY=synthetic\n"
    )

    def broken(*_: object, **__: object) -> Any:
        raise http.client.RemoteDisconnected("synthetic")

    monkeypatch.setattr(backup_copy, "copy", broken)
    with _collector() as (url, posts):
        code = backup_copy.main(["copy"], {
            "PEAL_BACKUP_COPY_CREDENTIALS": str(credentials),
            "PEAL_BACKUP_COPY_ENDPOINT": "https://example.test",
            "PEAL_BACKUP_COPY_SOURCE_BUCKET": "synthetic",
            "PEAL_BACKUP_COPY_SOURCE_PATH": "/production",
            "PEAL_BACKUP_COPY_BUCKET": "synthetic-copy",
            "PEAL_BACKUP_COPY_OTLP_URL": url,
            "PEAL_BACKUP_COPY_REPORT_RETRIES": "0",
        })

    assert code == 1
    assert posts == ["peal_backup_copy_last_failure_timestamp"]


@pytest.mark.parametrize(("result", "reported"), [("exit-code", True), ("timeout", True), ("oom-kill", True), ("success", False)])
def test_the_unit_reports_a_run_that_did_not_succeed(result: str, reported: bool) -> None:
    """ExecStopPost runs `failed`: whatever ended the run but success
    (flock, the time or memory limit), the failure gauge is posted."""
    with _collector() as (url, posts):
        code = backup_copy.main(["failed"], {
            "SERVICE_RESULT": result, "PEAL_BACKUP_COPY_OTLP_URL": url, "PEAL_BACKUP_COPY_REPORT_RETRIES": "0",
        })

    assert code == 0
    assert posts == (["peal_backup_copy_last_failure_timestamp"] if reported else [])


# Whatever the copy bucket holds, written by whoever holds its key, stops
# no command: a run it cannot read is a run it does not trust.

PLANTED = ["2026-99-99T999999Z", "2026-02-30T250000Z", "0000-00-00T000000Z-ff",
           # Times, but out of range: arithmetic on them would overflow.
           "0001-01-01T000000Z", "9999-12-31T235959Z", "2019-12-31T235959Z-0a"]


def test_a_planted_name_that_is_no_time_stops_nothing() -> None:
    source, copy_bucket, clock = _fake()
    honest, _ = backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])
    for name in PLANTED:
        copy_bucket.put_new(f"{name}/index.json", b"x", 1, PART)
    clock[0] += DAY
    source.write("production/backup/peal/backup.info", b"next day")

    later, written = backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])
    lines = list(backup_copy.describe_runs(_fake_settings(source, copy_bucket), clock[0]))

    assert later is not None and written == 2
    assert sum("NOT TRUSTED: its name is no time" in line or "NOT TRUSTED: its name is out of range" in line
               for line in lines) == len(PLANTED)
    assert backup_copy.rebuild(_fake_settings(source, copy_bucket), honest, "rebuilt", clock[0]) == []


@pytest.mark.parametrize("content", [b"x", b"{}", b'{"objects": []}', b'{"objects": {"a": {"copy": "elsewhere"}}}',
                                     b'{"objects": {"a": {"copy": "2027-01-03T021500Z/a", "size": -1, "sha256": "", "source_etag": ""}}}',
                                     b"[" * 100_000])
def test_a_trusted_index_that_is_none_stops_nothing(content: bytes) -> None:
    """An index the store's times make trusted, but that is not one the
    copy writes: the next run falls back on the run before, `runs` says so
    and goes on, and `rebuild` refuses it alone."""
    source, copy_bucket, clock = _fake(lock_days=0)
    honest, _ = backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])
    clock[0] += datetime.timedelta(minutes=10)
    forged = f"{clock[0]:%Y-%m-%dT%H%M%S}Z"
    copy_bucket.put_new(f"{forged}/index.json", content, len(content), PART)
    clock[0] += DAY

    assert backup_copy.copy(_fake_settings(source, copy_bucket), clock[0]) == (None, 0)
    lines = list(backup_copy.describe_runs(_fake_settings(source, copy_bucket), clock[0]))
    assert [line.split()[0] for line in lines] == [honest, forged]
    assert "NOT READABLE" in lines[1]
    with pytest.raises(backup_copy.CopyError, match="not readable"):
        backup_copy.rebuild(_fake_settings(source, copy_bucket), forged, "rebuilt", clock[0])
    assert backup_copy.rebuild(_fake_settings(source, copy_bucket), honest, "rebuilt", clock[0]) == []


def test_runs_says_which_runs_rebuild_would_take() -> None:
    source, copy_bucket, clock = _fake()
    first, _ = backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])
    incident = clock[0] + DAY
    clock[0] += 2 * DAY
    source.write("production/backup/peal/backup.info", b"after")
    second, _ = backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])

    gets = copy_bucket.gets
    lines = list(backup_copy.describe_runs(_fake_settings(source, copy_bucket), clock[0], before=incident))

    # The run stored after --before is not read; the one before is.
    assert copy_bucket.gets - gets == 1
    assert lines[0] == f"{second}  index stored {clock[0]:%Y-%m-%dT%H:%M:%SZ}  STORED AT OR AFTER --before: not read"
    assert lines[1].startswith(f"{first} ") and "a candidate" in lines[1]
    one = backup_copy.describe_run(_fake_settings(source, copy_bucket), first, clock[0], incident)
    assert one.endswith("REBUILD WOULD TAKE IT")
    assert "REBUILD REFUSES IT" in backup_copy.describe_run(_fake_settings(source, copy_bucket), second, clock[0], incident)


def test_no_run_stored_before_the_trust_begins_is_reused() -> None:
    """After an incident in which the repository was kept: a run written
    while the server was held, timely by the store's clock, is reused by
    no later run once PEAL_BACKUP_COPY_TRUST_AFTER names the incident's
    end."""
    source, copy_bucket, clock = _fake()
    backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])
    clock[0] += DAY
    held, _ = backup_copy.copy(_fake_settings(source, copy_bucket), clock[0] + datetime.timedelta(seconds=1))
    trust = clock[0] + datetime.timedelta(hours=1)
    clock[0] += DAY
    settings = dataclasses.replace(_fake_settings(source, copy_bucket), trust_after=trust)

    run, written = backup_copy.copy(settings, clock[0])

    assert written == len(REPOSITORY) + 1
    assert all(entry["copy"].startswith(f"{run}/")
               for entry in json.loads(copy_bucket.get(f"{run}/index.json"))["objects"].values())
    assert any("PEAL_BACKUP_COPY_TRUST_AFTER" in line for line in backup_copy.describe_runs(settings, clock[0]))


@pytest.mark.parametrize("off", [-DAY, DAY, datetime.timedelta(minutes=6)])
def test_a_host_clock_far_from_the_store_s_fails_the_run_first(off: datetime.timedelta) -> None:
    """A host clock that is not the store's would write runs no later run
    trusts: the run stops before it copies anything."""
    source, copy_bucket, clock = _fake()

    with pytest.raises(backup_copy.CopyError, match="clock"):
        backup_copy.copy(_fake_settings(source, copy_bucket), clock[0] + off)
    assert copy_bucket.objects == {}


def test_keys_that_are_not_a_run_s_index_are_none() -> None:
    """A trailing newline, a control character: no run's index."""
    for key in ["2027-01-03T021500Z/index.json\n", "2027-01-03T021500Z/index.json\x00", "2027-01-03T021500Z\n/index.json",
                "2027-01-03T021500Z/\x01/index.json"]:
        assert backup_copy._index_name(key) is None
    assert backup_copy._index_name("2027-01-03T021500Z-ab12/index.json") == "2027-01-03T021500Z-ab12"


def test_an_unjudgeable_run_is_untrusted_never_an_error(monkeypatch: pytest.MonkeyPatch) -> None:
    """Whatever error judging a run raises, a kind nobody thought of
    included, makes that run untrusted, and the command goes on."""
    source, copy_bucket, clock = _fake()

    def broken(_: str) -> datetime.datetime:
        raise ArithmeticError("synthetic")

    monkeypatch.setattr(backup_copy, "run_time", broken)
    found = backup_copy.judge(_fake_settings(source, copy_bucket), "2027-01-03T021500Z",
                              backup_copy.Stored(1, "", clock[0]), clock[0])

    assert (found.trusted, found.why) == (False, "not judged: ArithmeticError")


class Flooded(FakeStore):
    """A copy bucket that also lists a million empty objects someone
    planted, made as they are listed and never kept, half of them indexes
    no run would trust."""

    planted = 1_000_000

    def list(self, prefix: str = "", limit: int | None = None) -> Iterator[tuple[str, Any]]:
        if prefix:
            yield from super().list(prefix, limit)
            return
        self.listings += 1
        stored = backup_copy.Stored(0, "", self.clock[0])
        for number in range(self.planted):
            yield (f"1999-01-01T000000Z-{number:x}/index.json" if number % 2 else f"junk/{number}"), stored
        yield from super().list(prefix, limit)


def test_a_flood_of_planted_keys_costs_time_never_memory() -> None:
    """copy and runs stream the listing and keep run indexes alone, the
    newest trusted ones at most; rebuild reads the run's own keys and
    lists nothing. Python's allocations stay far below what a million
    retained keys take."""
    clock = [START]
    source, copy_bucket = FakeStore("backups", clock), Flooded("copy", clock, LOCK_DAYS)
    for key, data in REPOSITORY.items():
        source.write(f"production/{key}", data)
    honest, _ = backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])
    clock[0] += DAY
    source.write("production/backup/peal/backup.info", b"next day")

    tracemalloc.start()
    try:
        later, written = backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])
        lines = sum(1 for _ in backup_copy.describe_runs(_fake_settings(source, copy_bucket), clock[0]))
        _, peak = tracemalloc.get_traced_memory()
    finally:
        tracemalloc.stop()

    assert later is not None and written == 2
    assert lines == Flooded.planted // 2 + 2
    # A million keys kept would take some 300 MB.
    assert peak < 32 * 1024 * 1024
    listings = copy_bucket.listings
    assert backup_copy.rebuild(_fake_settings(source, copy_bucket), honest, "rebuilt", clock[0]) == []
    assert copy_bucket.listings == listings
    assert backup_copy.describe_run(_fake_settings(source, copy_bucket), honest, clock[0], None).startswith(f"{honest}  ")
    assert copy_bucket.listings == listings


class Unanswering(FakeStore):
    """A store that answers 503 for every index it is asked for."""

    def get(self, key: str) -> bytes:
        if key.endswith("/index.json"):
            raise backup_copy.StoreError("synthetic", 503)
        return super().get(key)


def test_an_index_the_store_does_not_give_fails_the_run_rather_than_copy_again() -> None:
    clock = [START]
    source, copy_bucket = FakeStore("backups", clock), FakeStore("copy", clock, LOCK_DAYS)
    for key, data in REPOSITORY.items():
        source.write(f"production/{key}", data)
    run, _ = backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])
    clock[0] += DAY
    flaky = Unanswering("copy", clock, LOCK_DAYS)
    flaky.objects = copy_bucket.objects
    before = set(flaky.objects)

    with pytest.raises(backup_copy.Unreachable):
        backup_copy.copy(_fake_settings(source, flaky), clock[0])
    assert set(flaky.objects) == before
    assert [line for line in backup_copy.describe_runs(_fake_settings(source, flaky), clock[0]) if "UNREACHABLE" in line]
    assert "UNREACHABLE" in backup_copy.describe_run(_fake_settings(source, flaky), run, clock[0], None)


def test_a_rebuild_from_before_an_incident_ignores_the_trust_s_start() -> None:
    """After the runbook's last step sets PEAL_BACKUP_COPY_TRUST_AFTER to
    an incident's end, an honest run of before the incident still
    rebuilds, given --before at the incident's start."""
    source, copy_bucket, clock = _fake()
    honest, _ = backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])
    incident = clock[0] + DAY
    clock[0] += 3 * DAY
    settings = dataclasses.replace(_fake_settings(source, copy_bucket), trust_after=clock[0])

    assert backup_copy.rebuild(settings, honest, "rebuilt", incident) == []
    assert backup_copy.describe_run(settings, honest, clock[0], incident).endswith("REBUILD WOULD TAKE IT")
    # Without --before before it, the trust's start holds.
    assert "PEAL_BACKUP_COPY_TRUST_AFTER" in backup_copy.describe_run(settings, honest, clock[0], None)


def test_a_run_whose_index_would_be_too_large_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    source, copy_bucket, clock = _fake()
    monkeypatch.setattr(backup_copy, "INDEX_LIMIT", 1000)

    with pytest.raises(backup_copy.CopyError, match="too many files"):
        backup_copy.copy(_fake_settings(source, copy_bucket), clock[0])
    assert copy_bucket.objects == {}


def test_the_bucket_never_shows_its_keys() -> None:
    bucket = backup_copy.Bucket("https://example.test", "auto", "synthetic", "synthetic-id", "synthetic-secret-value")

    assert "synthetic-secret-value" not in repr(bucket)
    assert "synthetic-id" not in repr(bucket)


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
    # The credentials file reaches the run through systemd, as a user of
    # its own, which could not read it otherwise.
    assert environ["PEAL_BACKUP_COPY_CREDENTIALS"] == "%d/credentials"
    assert "LoadCredential=credentials:/srv/peal/credentials.env" in service.splitlines()
    assert "DynamicUser=true" in service.splitlines()
    # Settings alone: the keys stay in the credentials file.
    assert not [name for name in environ if "KEY" in name or "SECRET" in name]
    assert environ["PEAL_BACKUP_COPY_LOCK_DAYS"] == "35"
    # Under the backups' lock, so never while pgBackRest rewrites its files,
    # and no longer than an index's time is trusted after its name.
    assert "ExecStart=/usr/bin/flock --wait 21600 /run/peal-backup.lock /usr/bin/python3 -I /usr/local/sbin/peal-backup-copy copy" in service
    assert "TimeoutStartSec=12h" in service.splitlines()
    assert environ["PEAL_BACKUP_COPY_MAX_RUN_HOURS"] == "12"
    assert "PEAL_BACKUP_COPY_TRUST_AFTER" not in environ
    # The lock's file readable by the run's user whatever the umask, and a
    # run that ends otherwise than in success reports it.
    lines = service.splitlines()
    assert lines.index("ExecStartPre=+/usr/bin/touch /run/peal-backup.lock") < lines.index(
        "ExecStartPre=+/usr/bin/chgrp peal-backup-lock /run/peal-backup.lock") < lines.index(
        "ExecStartPre=+/usr/bin/chmod 0640 /run/peal-backup.lock") < lines.index(
        "ExecStart=/usr/bin/flock --wait 21600 /run/peal-backup.lock /usr/bin/python3 -I /usr/local/sbin/peal-backup-copy copy")
    assert "SupplementaryGroups=peal-backup-lock" in lines
    # The failure's report fits in the stop limit.
    assert "ExecStopPost=/usr/bin/env PEAL_BACKUP_COPY_REPORT_RETRIES=2 /usr/bin/python3 -I /usr/local/sbin/peal-backup-copy failed" in lines
    assert "TimeoutStopSec=2min" in lines
    assert (folder / "peal-backup.tmpfiles").read_text().splitlines()[-1] == "f /run/peal-backup.lock 0640 root peal-backup-lock -"
    for line in ["ProtectSystem=strict", "ProtectHome=true", "PrivateDevices=true", "NoNewPrivileges=true",
                 "CapabilityBoundingSet=", "RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX"]:
        assert line in service.splitlines()


def test_the_trust_s_start_reaches_the_unit(rendered_with: Callable[..., Path]) -> None:
    folder = rendered_with(**COPY, peal_backup_copy_trust_after="2026-11-24T12:00:00Z") / "peal-production"

    assert "Environment=PEAL_BACKUP_COPY_TRUST_AFTER=2026-11-24T12:00:00Z" in (
        folder / "peal-backup-copy.service").read_text().splitlines()


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


@pytest.mark.parametrize(("value", "holds"), [
    ("", True), ("2026-11-24T12:00:00Z", True),
    # YAML reads an unquoted instant as a date of its own.
    (datetime.datetime(2026, 11, 24, 12, tzinfo=datetime.UTC), False),
    ("2026-11-24T12:00:00", False), ("2026-11-24T12:00:00+01:00", False), ("tomorrow", False),
])
def test_the_preflight_takes_a_quoted_utc_instant_for_the_trust_s_start(value: Any, holds: bool) -> None:
    found = next(
        item for item in yaml.safe_load((INFRA / "roles" / "peal_preflight" / "tasks" / "main.yml").read_text())
        if item["name"] == "Refuse a backup copy's trust start that is no quoted UTC instant"
    )

    assert ansible_render("{{ " + found["ansible.builtin.assert"]["that"] + " }}",
                          peal_backup_copy_trust_after=value) is holds


def test_the_lock_and_the_refresh_agree_with_the_bucket_s_rules() -> None:
    """The role's lock days are the Pulumi stack's; a file is copied again
    before the lifecycle rule deletes its copy; the lock outlasts a week of
    backups, so the newest full backup is always locked."""
    source = (INFRA.parent / "pulumi" / "src" / "environment.ts").read_text()
    lock = int(re.search(r"backupCopyLockDays = (\d+);", source).group(1))  # type: ignore[union-attr]
    retention = int(re.search(r"backupCopyRetentionDays = (\d+);", source).group(1))  # type: ignore[union-attr]
    defaults = role_file("peal_backup", "defaults")

    assert defaults["peal_backup_copy_lock_days"] == lock
    # Every file the newest index names stays locked 14 days after it.
    assert lock - defaults["peal_backup_copy_refresh_days"] >= 14
    assert retention > lock


# Grafana's rules on the copy (peal-docker's rules.yaml), on the gauges the
# script posts, which Prometheus names with their unit.
RULES = INFRA.parent.parent / "peal-docker" / "config" / "production" / "grafana" / "alerting" / "rules.yaml"
SUCCESS = "peal_backup_copy_last_success_timestamp_seconds"
FAILURE = "peal_backup_copy_last_failure_timestamp_seconds"
BACKUP = "peal_backup_last_success_timestamp_seconds"
# What peal-backup posts after each backup where the copy is on.
EXPECTED = "peal_backup_copy_expected_timestamp_seconds"
BACKUP_SCRIPT = INFRA / "roles" / "peal_backup" / "templates" / "peal-backup.j2"


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
    assert {SUCCESS, EXPECTED} <= set(re.findall(r"peal_backup\w+", _query("peal-backup-copy-behind")))
    for uid in ["peal-backup-copy-failed", "peal-backup-copy-behind"]:
        # A server without the copy posts none of its gauges.
        assert (_rule(uid)["noDataState"], _rule(uid)["labels"]) == ("OK", {"severity": "critical"})


def test_the_backup_says_a_copy_is_due_only_where_the_copy_runs() -> None:
    """So that a copy turned on that never succeeds alerts, and a server
    without the copy posts nothing of it."""
    script = BACKUP_SCRIPT.read_text()

    on = str(ansible_render(script, peal_backup_copy=True, peal_compose_bin="peal-compose",
                            peal_ports={"otlp_http": 14318}, peal_backup_report_retries=6,
                            peal_backup_report_retry_delay=10))
    off = str(ansible_render(script, peal_backup_copy=False, peal_compose_bin="peal-compose",
                             peal_ports={"otlp_http": 14318}, peal_backup_report_retries=6,
                             peal_backup_report_retry_delay=10))

    assert "report peal_backup_copy_expected_timestamp " in on
    assert "peal_backup_copy" not in off


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
     {EXPECTED: "1000x20", SUCCESS: "1100x20"}, [(15, False)]),
    ("a backup the copy missed", "peal-backup-copy-behind", 21600,
     {EXPECTED: "1000x9 30000x10", SUCCESS: "1100x20"}, [(5, False), (15, True)]),
    # Turned on, and never once succeeded: it fires, rather than no data.
    ("a copy that never succeeded", "peal-backup-copy-behind", 21600,
     {EXPECTED: "30000x20"}, [(15, True)]),
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
