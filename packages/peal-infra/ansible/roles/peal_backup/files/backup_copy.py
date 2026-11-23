#!/usr/bin/python3
"""Copies pgBackRest's repository into the backup copy's bucket, which a
bucket lock keeps from any overwrite or deletion for PEAL_BACKUP_COPY_LOCK_DAYS
(35) from the time the store wrote each object (the Pulumi project's
environment stacks, `backupCopy`), so that whoever holds the server, and
with it the one key that can delete every backup, cannot take the last
copies too.

Managed by Ansible (peal-infra, the peal_backup role), which installs it as
peal-backup-copy and runs it after each backup that succeeded and from a
daily timer, under the backups' lock. Standard library only.

Each run writes under a prefix of its own, `<run>/`, the time it started
(`2026-11-23T021500Z`), so no key is ever written twice:

- the repository's files the newest trusted index does not hold as they
  are now (backup.info and the manifests, which pgBackRest rewrites, are
  copied as each run finds them), or holds in a copy the store wrote more
  than PEAL_BACKUP_COPY_REFRESH_DAYS (21) ago;
- last, `<run>/index.json`: every file of the repository as the run found
  it, the key of its copy (which may be an earlier run's), its size and its
  SHA-256, computed while the run copied it. A run with an index is
  complete. A run also writes a new index once the newest is older than the
  refresh, even with nothing else to copy.

So every file the newest index names has a copy the store wrote less than
21 days before that run, which the lock keeps for 14 days more at least:
however the server is taken, the newest complete run before it stays whole
for 14 days from that run, which runs daily, so about 13 days after the
server is taken at worst.

The store's clock, not a run's name, says when something was written: a
run whose index the store wrote more than PEAL_BACKUP_COPY_MAX_RUN_HOURS
(12, the unit's time limit) after its name, or before it, or named in the
future, or whose name is no time, or stored before
PEAL_BACKUP_COPY_TRUST_AFTER (an incident's end), is not trusted; `rebuild`
refuses it, refuses an index that names a copy the store wrote after the
index, and, given the time an incident began (`--before`), anything the
store wrote at or after it. Whatever the copy bucket holds, by its name,
time, size or content, is checked where it is read: an index that is not
one is skipped as not readable, never the end of a command. A run's name
ends with random characters, so no one can take the next run's prefix.

  peal-backup-copy copy                     one run
  peal-backup-copy runs [--before <time>]   the complete runs, oldest first,
                                            with the store's times, and
                                            which rebuild would take
  peal-backup-copy failed                   reports a failure, from the
                                            unit's ExecStopPost, unless the
                                            run succeeded
  peal-backup-copy rebuild --run <run> --before <time> --to-path <path>
                                            writes the run's set into the
                                            backup bucket under a new path

Settings come from the environment (the systemd unit): the endpoint, the
buckets, the repository's path, the collector's address. The keys come
from PEAL_BACKUP_COPY_CREDENTIALS (the credentials file systemd hands the
unit), read by name, never from the command line, and are never printed.
The files are those pgBackRest encrypted before they left the host: the
copy needs no passphrase, and cannot read them.
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import hmac
import http.client
import json
import os
import secrets
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ElementTree
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, BinaryIO, Protocol

# A run's prefix: the time it began, then random characters; a name that
# matches but is no time (2026-99-99T999999Z) is an untrusted run.
RUN = re.compile(r"^(\d{4}-\d{2}-\d{2}T\d{6}Z(?:-[0-9a-f]{1,32})?)/(.+)$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
# An index larger than this is not one the copy wrote: it is not read.
INDEX_LIMIT = 64 * 1024 * 1024
INDEX = "index.json"
S3 = "{http://s3.amazonaws.com/doc/2006-03-01/}"
CHUNK = 1024 * 1024
# How far the store's clock and this host's may disagree.
SKEW = datetime.timedelta(minutes=5)


class CopyError(Exception):
    """A failure the run reports in words of its own, never a secret."""


@dataclass(frozen=True)
class Stored:
    """An object as the store lists it: its size, ETag and the time the
    store wrote it, by the store's own clock."""

    size: int
    etag: str
    modified: datetime.datetime


class Store(Protocol):
    """What the copy needs of a bucket."""

    name: str

    def list(self, prefix: str = "") -> Iterator[tuple[str, Stored]]: ...

    def get(self, key: str) -> bytes: ...

    def open(self, key: str) -> tuple[int, str, BinaryIO]: ...

    def put_new(self, key: str, body: BinaryIO | bytes, size: int, part_size: int) -> str: ...


def _modified(text: str | None) -> datetime.datetime:
    """An S3 listing's LastModified, such as 2026-11-23T02:15:00.000Z."""
    if not text:
        raise CopyError("the store gave an object without its time")
    return datetime.datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(datetime.UTC)


@dataclass(frozen=True)
class Bucket:
    """A bucket on an S3 API, with its key."""

    endpoint: str
    region: str
    name: str
    access_key: str = field(repr=False)
    secret_key: str = field(repr=False)

    def _sign(self, method: str, path: str, query: dict[str, str], headers: dict[str, str]) -> dict[str, str]:
        now = datetime.datetime.now(datetime.UTC)
        stamp = now.strftime("%Y%m%dT%H%M%SZ")
        day = now.strftime("%Y%m%d")
        host = urllib.parse.urlsplit(self.endpoint).netloc
        signed = {
            **{name.lower(): value for name, value in headers.items()},
            "host": host,
            "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
            "x-amz-date": stamp,
        }
        names = sorted(signed)
        canonical = "\n".join([
            method,
            urllib.parse.quote(path, safe="/-_.~"),
            _query(query),
            "".join(f"{name}:{signed[name].strip()}\n" for name in names),
            ";".join(names),
            "UNSIGNED-PAYLOAD",
        ])
        scope = f"{day}/{self.region}/s3/aws4_request"
        to_sign = "\n".join([
            "AWS4-HMAC-SHA256", stamp, scope, hashlib.sha256(canonical.encode()).hexdigest(),
        ])
        key = f"AWS4{self.secret_key}".encode()
        for part in (day, self.region, "s3", "aws4_request"):
            key = hmac.new(key, part.encode(), hashlib.sha256).digest()
        signature = hmac.new(key, to_sign.encode(), hashlib.sha256).hexdigest()
        signed["authorization"] = (
            f"AWS4-HMAC-SHA256 Credential={self.access_key}/{scope}, "
            f"SignedHeaders={';'.join(names)}, Signature={signature}"
        )
        return signed

    def request(
        self,
        method: str,
        key: str = "",
        query: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
        body: BinaryIO | bytes | None = None,
    ) -> http.client.HTTPResponse:
        """Sends one signed request, path style; the caller reads the answer."""
        query = query or {}
        parts = urllib.parse.urlsplit(self.endpoint)
        path = f"{parts.path.rstrip('/')}/{self.name}" + (f"/{key}" if key else "")
        signed = self._sign(method, path, query, headers or {})
        connection_type = http.client.HTTPSConnection if parts.scheme == "https" else http.client.HTTPConnection
        connection = connection_type(parts.netloc, timeout=300)
        target = urllib.parse.quote(path, safe="/-_.~")
        if query:
            target += "?" + _query(query)
        connection.request(method, target, body=body, headers=signed)
        return connection.getresponse()

    def call(
        self,
        method: str,
        key: str = "",
        expect: tuple[int, ...] = (200,),
        query: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
        body: bytes | None = None,
    ) -> bytes:
        response = self.request(method, key, query=query, headers=headers, body=body)
        data = response.read()
        if response.status not in expect:
            code = re.search(rb"<Code>([^<]+)</Code>", data)
            raise CopyError(
                f"{method} on {self.name}/{key} answered {response.status}"
                + (f" ({code.group(1).decode()})" if code else "")
            )
        return data

    def list(self, prefix: str = "") -> Iterator[tuple[str, Stored]]:
        """Every object under the prefix, with the store's time for it."""
        token: str | None = None
        while True:
            query = {"list-type": "2", "prefix": prefix}
            if token:
                query["continuation-token"] = token
            tree = ElementTree.fromstring(self.call("GET", query=query))
            for item in tree.iter(f"{S3}Contents"):
                yield item.findtext(f"{S3}Key") or "", Stored(
                    int(item.findtext(f"{S3}Size") or "0"),
                    (item.findtext(f"{S3}ETag") or "").strip('"'),
                    _modified(item.findtext(f"{S3}LastModified")),
                )
            if tree.findtext(f"{S3}IsTruncated") != "true":
                return
            token = tree.findtext(f"{S3}NextContinuationToken")

    def get(self, key: str) -> bytes:
        return self.call("GET", key)

    def open(self, key: str) -> tuple[int, str, BinaryIO]:
        """The object's size, its ETag as the GET gives it, and its bytes."""
        response = self.request("GET", key)
        if response.status != 200:
            response.read()
            raise CopyError(f"GET of {self.name}/{key} answered {response.status}")
        try:
            size = int(response.getheader("Content-Length") or "-1")
        except ValueError:
            size = -1
        return size, (response.getheader("ETag") or "").strip('"'), response

    def put_new(self, key: str, body: BinaryIO | bytes, size: int, part_size: int) -> str:
        """Writes a key that must not exist yet: the store refuses an
        existing one (If-None-Match: *), the bucket lock an overwrite of a
        locked one. Large files go in parts. Returns the ETag."""
        if size <= part_size:
            response = self.request("PUT", key, headers={
                "content-length": str(size), "if-none-match": "*",
            }, body=body)
            response.read()
            if response.status != 200:
                raise CopyError(f"PUT of {self.name}/{key} answered {response.status}")
            return (response.getheader("ETag") or "").strip('"')
        created = ElementTree.fromstring(self.call("POST", key, query={"uploads": ""}))
        upload = created.findtext(f"{S3}UploadId") or ""
        parts: list[str] = []
        try:
            left = size
            while left > 0:
                length = min(part_size, left)
                chunk = _read(body, size - left, length)
                if len(chunk) != length:
                    raise CopyError(f"{self.name}/{key}: the source ended early")
                response = self.request("PUT", key, query={
                    "partNumber": str(len(parts) + 1), "uploadId": upload,
                }, headers={"content-length": str(length)}, body=chunk)
                response.read()
                if response.status != 200:
                    raise CopyError(f"a part of {self.name}/{key} answered {response.status}")
                parts.append((response.getheader("ETag") or "").strip('"'))
                left -= length
            done = "".join(
                f"<Part><PartNumber>{number}</PartNumber><ETag>\"{etag}\"</ETag></Part>"
                for number, etag in enumerate(parts, start=1)
            )
            answer = self.call("POST", key, query={"uploadId": upload}, headers={"if-none-match": "*"},
                               body=f"<CompleteMultipartUpload>{done}</CompleteMultipartUpload>".encode())
            return (ElementTree.fromstring(answer).findtext(f"{S3}ETag") or "").strip('"')
        except BaseException:
            self.request("DELETE", key, query={"uploadId": upload}).read()
            raise


def _query(query: dict[str, str]) -> str:
    return "&".join(
        f"{urllib.parse.quote(name, safe='-_.~')}={urllib.parse.quote(value, safe='-_.~')}"
        for name, value in sorted(query.items())
    )


def _read(body: BinaryIO | bytes, offset: int, length: int) -> bytes:
    """The next `length` bytes of a body, at `offset` in bytes or read on
    from a stream, which may give fewer at a time."""
    if isinstance(body, bytes):
        return body[offset:offset + length]
    chunks: list[bytes] = []
    left = length
    while left > 0:
        chunk = body.read(min(left, CHUNK))
        if not chunk:
            break
        chunks.append(chunk)
        left -= len(chunk)
    return b"".join(chunks)


class _Digesting:
    """A stream that hashes what is read from it, as it is read."""

    def __init__(self, stream: BinaryIO) -> None:
        self.stream = stream
        self.sha256 = hashlib.sha256()
        self.md5 = hashlib.md5(usedforsecurity=False)
        self.length = 0

    def read(self, size: int = -1) -> bytes:
        data = self.stream.read(size)
        self.sha256.update(data)
        self.md5.update(data)
        self.length += len(data)
        return data


def _multipart(etag: str) -> bool:
    """An ETag of an upload in parts, which is no digest of the content."""
    return "-" in etag


def copy_object(source: Store, key: str, target: Store, to: str, size: int, etag: str, part_size: int) -> str:
    """Streams one object from a bucket into a new key of another, and
    checks the bytes: the size, the source's ETag where it is the content's
    MD5, and the new copy's ETag likewise. Returns the SHA-256."""
    length, given, stream = source.open(key)
    if length != size or (etag and given and given != etag):
        raise CopyError(f"{source.name}/{key} changed while it was copied")
    digesting = _Digesting(stream)
    written = target.put_new(to, digesting, size, part_size)  # type: ignore[arg-type]
    md5 = digesting.md5.hexdigest()
    if digesting.length != size:
        raise CopyError(f"{source.name}/{key} ended early")
    if etag and not _multipart(etag) and etag != md5:
        raise CopyError(f"{source.name}/{key} did not read back as the store holds it")
    if written and not _multipart(written) and written != md5:
        raise CopyError(f"{target.name}/{to} was not stored as it was sent")
    return digesting.sha256.hexdigest()


def run_time(run: str) -> datetime.datetime:
    """When a run's name says it began; ValueError for a name that is no
    time."""
    return datetime.datetime.strptime(run[:18], "%Y-%m-%dT%H%M%SZ").replace(tzinfo=datetime.UTC)


def _named(run: str) -> datetime.datetime | None:
    try:
        return run_time(run)
    except ValueError:
        return None


@dataclass(frozen=True)
class Settings:
    source: Store
    copy: Store
    path: str
    refresh_days: int
    part_size: int
    lock_days: int = 35
    max_run_hours: int = 12
    # After an incident in which the repository was kept: no run the store
    # wrote before this is trusted, so honest runs reuse nothing of a run
    # written while the server was held.
    trust_after: datetime.datetime | None = None

    @property
    def prefix(self) -> str:
        """The repository's keys start with its path, without the leading
        slash pgBackRest takes it with."""
        path = self.path.strip("/")
        return f"{path}/" if path else ""


@dataclass(frozen=True)
class Run:
    """A complete run of the copy, as the store holds its index."""

    name: str
    stored: datetime.datetime
    size: int
    trusted: bool
    why: str


@dataclass(frozen=True)
class Entry:
    """A file of the repository as an index names it."""

    copy: str
    size: int
    sha256: str
    source_etag: str

    def document(self) -> dict[str, Any]:
        return {"copy": self.copy, "sha256": self.sha256, "size": self.size, "source_etag": self.source_etag}


def _runs(settings: Settings, listing: dict[str, Stored], now: datetime.datetime) -> list[Run]:
    """The runs whose index the copy holds, oldest first by the store's
    time, each trusted or not: an index whose name is no time, that the
    store wrote before its name, more than the unit's time limit after it,
    or before PEAL_BACKUP_COPY_TRUST_AFTER, or named in the future, was
    written by someone else than the run it names. Never raises on what
    the bucket holds."""
    runs = []
    limit = datetime.timedelta(hours=settings.max_run_hours) + SKEW
    for key, stored in listing.items():
        found = RUN.match(key)
        if not found or found.group(2) != INDEX:
            continue
        named = _named(found.group(1))
        if named is None:
            why = "its name is no time"
        elif named > now + SKEW:
            why = "named in the future"
        elif stored.modified < named - SKEW:
            why = "stored before its name says it began"
        elif stored.modified > named + limit:
            why = f"stored {stored.modified - named} after its name"
        elif settings.trust_after is not None and stored.modified < settings.trust_after:
            why = "stored before the copy's trust begins (PEAL_BACKUP_COPY_TRUST_AFTER)"
        else:
            why = ""
        runs.append(Run(found.group(1), stored.modified, stored.size, not why, why))
    return sorted(runs, key=lambda run: (run.stored, run.name))


def read_index(store: Store, run: Run) -> dict[str, Entry] | None:
    """A run's index in the shape the copy writes it, or None when it is
    not one: too large, not JSON, or any entry other than a copy key, a
    size, a SHA-256 and the source's ETag."""
    if run.size > INDEX_LIMIT:
        return None
    try:
        document = json.loads(store.get(f"{run.name}/{INDEX}"))
        objects = document["objects"]
        if not isinstance(objects, dict):
            return None
        entries = {}
        for key, entry in objects.items():
            if not (
                isinstance(key, str) and key and isinstance(entry, dict)
                and isinstance(entry.get("copy"), str) and RUN.match(entry["copy"])
                and isinstance(entry.get("size"), int) and not isinstance(entry["size"], bool) and entry["size"] >= 0
                and isinstance(entry.get("sha256"), str) and SHA256.match(entry["sha256"])
                and isinstance(entry.get("source_etag"), str)
            ):
                return None
            entries[key] = Entry(entry["copy"], entry["size"], entry["sha256"], entry["source_etag"])
    except (CopyError, ValueError, TypeError, KeyError, RecursionError, OSError, http.client.HTTPException):
        return None
    return entries


def _run_name(now: datetime.datetime) -> str:
    return f"{now:%Y-%m-%dT%H%M%S}Z-{secrets.token_hex(4)}"


def copy(settings: Settings, now: datetime.datetime | None = None) -> tuple[str | None, int]:
    """One run: the run's name and how many files it wrote, or None and 0
    when the copy already holds the repository as it is, fresh enough."""
    now = now or datetime.datetime.now(datetime.UTC)
    run = _run_name(now)
    source = {key.removeprefix(settings.prefix): stored for key, stored in settings.source.list(settings.prefix)}
    listing = dict(settings.copy.list())
    if any(key.startswith(f"{run}/") for key in listing):
        raise CopyError(f"the copy already holds a run {run}")

    fresh_after = now - datetime.timedelta(days=settings.refresh_days)
    # The newest trusted run whose index reads, or none.
    latest: Run | None = None
    previous: dict[str, Entry] = {}
    for found in reversed([found for found in _runs(settings, listing, now) if found.trusted]):
        entries = read_index(settings.copy, found)
        if entries is not None:
            latest, previous = found, entries
            break

    index: dict[str, Entry] = {}
    todo: list[str] = []
    for key, stored in sorted(source.items()):
        entry = previous.get(key)
        held = listing.get(entry.copy) if entry else None
        if (
            entry is not None
            and held is not None
            and latest is not None
            and entry.size == stored.size == held.size
            and entry.source_etag == stored.etag
            # Written by the store before the index that names it, so not
            # written again since, and fresh enough to stay locked.
            and held.modified <= latest.stored
            and held.modified > fresh_after
        ):
            index[key] = entry
        else:
            todo.append(key)

    if not todo and latest is not None and latest.stored > fresh_after and previous == index:
        return None, 0

    for key in todo:
        stored = source[key]
        sha256 = copy_object(
            settings.source, settings.prefix + key, settings.copy, f"{run}/{key}",
            stored.size, stored.etag, settings.part_size,
        )
        index[key] = Entry(f"{run}/{key}", stored.size, sha256, stored.etag)

    document = json.dumps(
        {
            "run": run,
            "source": {"bucket": settings.source.name, "path": settings.path},
            "objects": {key: entry.document() for key, entry in index.items()},
        },
        indent=1, sort_keys=True,
    ).encode()
    settings.copy.put_new(f"{run}/{INDEX}", document, len(document), settings.part_size)

    # The store dates the index: a host clock too far from the store's
    # would write runs no later run or rebuild trusts.
    written = {key: stored for key, stored in settings.copy.list(f"{run}/") if key == f"{run}/{INDEX}"}
    check = _runs(settings, written, now)
    if not check or not check[0].trusted:
        raise CopyError(f"the store does not date {run} as its name says ({check[0].why if check else 'not listed'}): check this host's clock")
    return run, len(todo) + 1


def check_run(
    settings: Settings, listing: dict[str, Stored], run: str, before: datetime.datetime
) -> tuple[dict[str, Entry], list[str]]:
    """What `rebuild` checks of a run before it writes anything: the files
    its index names, and those whose copy is gone. CopyError says why the
    run is refused."""
    found = next((found for found in _runs(settings, listing, before) if found.name == run), None)
    if found is None:
        raise CopyError(f"the copy holds no index of {run}")
    if not found.trusted:
        raise CopyError(f"{run} is not trusted: {found.why}")
    if found.stored >= before:
        raise CopyError(f"the store wrote {run}'s index at {found.stored:%Y-%m-%dT%H:%M:%SZ}, not before {before:%Y-%m-%dT%H:%M:%SZ}")
    objects = read_index(settings.copy, found)
    if objects is None:
        raise CopyError(f"{run}'s index is not readable")
    missing: list[str] = []
    for key, entry in sorted(objects.items()):
        held = listing.get(entry.copy)
        if held is None:
            missing.append(key)
        elif held.modified > found.stored or held.modified >= before:
            raise CopyError(f"the copy of {key} was written after {run}'s index, or not before the incident")
        elif held.size != entry.size:
            raise CopyError(f"the copy of {key} is not the one {run}'s index names")
    return objects, missing


def describe_runs(
    settings: Settings, now: datetime.datetime | None = None, before: datetime.datetime | None = None
) -> Iterator[str]:
    """A line for each complete run, oldest first, as it is read: its name,
    when the store wrote its index, the oldest copy it names and until when
    the lock keeps all of them; or why it is not trusted, or not readable;
    and, with `before`, whether `rebuild` would take it."""
    now = now or datetime.datetime.now(datetime.UTC)
    listing = dict(settings.copy.list())
    for found in _runs(settings, listing, now):
        head = f"{found.name}  index stored {found.stored:%Y-%m-%dT%H:%M:%SZ}"
        if not found.trusted:
            yield f"{head}  NOT TRUSTED: {found.why}"
            continue
        objects = read_index(settings.copy, found)
        if objects is None:
            yield f"{head}  NOT READABLE: its index is not one the copy writes"
            continue
        times = [listing[entry.copy].modified for entry in objects.values() if entry.copy in listing]
        missing = len(objects) - len(times)
        oldest = min(times, default=found.stored)
        locked = oldest + datetime.timedelta(days=settings.lock_days)
        line = (
            f"{head}  oldest copy stored {oldest:%Y-%m-%dT%H:%M:%SZ}"
            f"  {'all locked until' if locked > now else 'unlocked since'} {locked:%Y-%m-%dT%H:%M:%SZ}"
            + (f"  {missing} missing" if missing else "")
        )
        if before is not None:
            try:
                check_run(settings, listing, found.name, before)
                line += "  REBUILD WOULD TAKE IT"
            except CopyError as error:
                line += f"  REBUILD REFUSES IT: {error}"
        yield line


def rebuild(settings: Settings, run: str, to_path: str, before: datetime.datetime) -> list[str]:
    """Writes the run's set under a new path of the backup bucket, which
    must hold nothing, once its index and every copy it names pass the
    checks: the keys whose copy is gone (the copy's lifecycle rule), which
    it could not write."""
    target = to_path.strip("/")
    if not target or f"{target}/" == settings.prefix:
        raise CopyError("rebuild into a new path, never the repository's own")
    if next(iter(settings.source.list(f"{target}/")), None) is not None:
        raise CopyError(f"{target}/ already holds files")
    if not RUN.match(f"{run}/{INDEX}"):
        raise CopyError(f"{run} is no run")
    listing = dict(settings.copy.list())
    objects, missing = check_run(settings, listing, run, before)

    for key, entry in sorted(objects.items()):
        if key in missing:
            continue
        sha256 = copy_object(
            settings.copy, entry.copy, settings.source, f"{target}/{key}",
            entry.size, listing[entry.copy].etag, settings.part_size,
        )
        if sha256 != entry.sha256:
            raise CopyError(f"the copy of {key} does not hold what {run} copied")
    return missing


def _credentials(path: Path, *names: str) -> list[str]:
    """Reads NAME=value lines, quoted or not, for the names asked alone."""
    values: dict[str, str] = {}
    for line in path.read_text().splitlines():
        name, _, value = line.partition("=")
        if name in names:
            values[name] = value.strip().strip("'\"")
    missing = [name for name in names if not values.get(name)]
    if missing:
        raise CopyError(f"{path} lacks {', '.join(missing)}")
    return [values[name] for name in names]


def settings_from(environ: dict[str, str]) -> Settings:
    credentials = Path(environ.get("PEAL_BACKUP_COPY_CREDENTIALS", "/srv/peal/credentials.env"))
    source_key, source_secret, copy_key, copy_secret = _credentials(
        credentials,
        "PGBACKREST_REPO1_S3_KEY", "PGBACKREST_REPO1_S3_KEY_SECRET",
        "PEAL_BACKUP_COPY_S3_ACCESS_KEY_ID", "PEAL_BACKUP_COPY_S3_SECRET_ACCESS_KEY",
    )
    endpoint = environ["PEAL_BACKUP_COPY_ENDPOINT"]
    region = environ.get("PEAL_BACKUP_COPY_REGION", "auto")
    return Settings(
        source=Bucket(endpoint, region, environ["PEAL_BACKUP_COPY_SOURCE_BUCKET"], source_key, source_secret),
        copy=Bucket(endpoint, region, environ["PEAL_BACKUP_COPY_BUCKET"], copy_key, copy_secret),
        path=environ["PEAL_BACKUP_COPY_SOURCE_PATH"],
        refresh_days=int(environ.get("PEAL_BACKUP_COPY_REFRESH_DAYS", "21")),
        # S3 takes no part under 5 MiB but the last; a part is held in
        # memory, which the unit bounds (MemoryMax).
        part_size=max(5 * 1024 * 1024, int(environ.get("PEAL_BACKUP_COPY_PART_SIZE", str(64 * 1024 * 1024)))),
        lock_days=int(environ.get("PEAL_BACKUP_COPY_LOCK_DAYS", "35")),
        max_run_hours=int(environ.get("PEAL_BACKUP_COPY_MAX_RUN_HOURS", "12")),
        trust_after=_instant(environ["PEAL_BACKUP_COPY_TRUST_AFTER"]) if environ.get("PEAL_BACKUP_COPY_TRUST_AFTER") else None,
    )


def report(environ: dict[str, str], name: str, description: str) -> None:
    """Posts one gauge, now, to the collector, as peal-backup does."""
    url = environ.get("PEAL_BACKUP_COPY_OTLP_URL")
    if not url:
        return
    now = int(time.time())
    body = json.dumps({"resourceMetrics": [{
        "resource": {"attributes": [{"key": "service.name", "value": {"stringValue": "peal-backup-copy"}}]},
        "scopeMetrics": [{"scope": {"name": "peal-backup-copy"}, "metrics": [{
            "name": name, "unit": "s", "description": description,
            "gauge": {"dataPoints": [{"timeUnixNano": f"{now}000000000", "asInt": str(now)}]},
        }]}],
    }]}).encode()
    retries = int(environ.get("PEAL_BACKUP_COPY_REPORT_RETRIES", "6"))
    delay = float(environ.get("PEAL_BACKUP_COPY_REPORT_RETRY_DELAY", "10"))
    for attempt in range(retries + 1):
        try:
            request = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(request, timeout=10):
                return
        except (urllib.error.URLError, OSError, http.client.HTTPException):
            if attempt == retries:
                print(f"peal-backup-copy: the collector did not record {name}", file=sys.stderr)
                return
            time.sleep(delay)


def _instant(text: str) -> datetime.datetime:
    """A time with its zone, such as 2026-11-23T02:00:00Z."""
    found = datetime.datetime.fromisoformat(text.replace("Z", "+00:00"))
    if found.tzinfo is None:
        raise argparse.ArgumentTypeError("give the time with its zone, such as 2026-11-23T02:00:00Z")
    return found.astimezone(datetime.UTC)


def main(argv: list[str] | None = None, environ: dict[str, str] | None = None) -> int:
    environ = dict(os.environ if environ is None else environ)
    parser = argparse.ArgumentParser(prog="peal-backup-copy")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("copy")
    commands.add_parser("failed")
    listing = commands.add_parser("runs")
    listing.add_argument("--before", type=_instant,
                         help="when an incident began: says which runs rebuild would take")
    rebuilding = commands.add_parser("rebuild")
    rebuilding.add_argument("--run", required=True)
    rebuilding.add_argument("--to-path", required=True)
    rebuilding.add_argument("--before", required=True, type=_instant,
                            help="when the incident began, by the store's clock (UTC)")
    arguments = parser.parse_args(argv)
    if arguments.command == "failed":
        # From the unit's ExecStopPost: a run that ended otherwise than in
        # success (flock refused, the memory or the time limit, a signal)
        # reports it too, as the script's own failures do.
        if environ.get("SERVICE_RESULT", "success") != "success":
            report(environ, "peal_backup_copy_last_failure_timestamp", "When the last backup copy failed")
        return 0
    try:
        settings = settings_from(environ)
        if arguments.command == "runs":
            for line in describe_runs(settings, before=arguments.before):
                print(line, flush=True)
            return 0
        if arguments.command == "rebuild":
            missing = rebuild(settings, arguments.run, arguments.to_path, arguments.before)
            for key in missing:
                print(f"missing {key}")
            print(f"rebuilt {arguments.run} under {arguments.to_path.strip('/')}/, {len(missing)} missing")
            return 1 if missing else 0
        run, written = copy(settings)
        print(f"copied run {run}, {written} files" if run else "the copy is up to date")
    except Exception as error:  # noqa: BLE001 - every failure is reported, never a traceback alone.
        # A missing setting names itself; a failure of the copy's own says
        # what failed; any other error says its kind alone, never a value it
        # may carry.
        message = (
            str(error) if isinstance(error, CopyError)
            else f"setting {error} is not set" if isinstance(error, KeyError)
            else type(error).__name__
        )
        print(f"peal-backup-copy: {message}", file=sys.stderr)
        if arguments.command == "copy":
            report(environ, "peal_backup_copy_last_failure_timestamp", "When the last backup copy failed")
        return 1
    report(environ, "peal_backup_copy_last_success_timestamp", "When the backup copy last matched the backups")
    return 0


if __name__ == "__main__":
    sys.exit(main())
