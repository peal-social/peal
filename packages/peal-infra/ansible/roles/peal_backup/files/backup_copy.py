#!/usr/bin/python3
"""Copies pgBackRest's repository into the backup copy's bucket, which a
bucket lock keeps from any overwrite or deletion for a while (the Pulumi
project's environment stacks, `backupCopy`), so that whoever holds the
server, and with it the one key that can delete every backup, cannot take
the last copies too.

Managed by Ansible (peal-infra, the peal_backup role), which installs it as
peal-backup-copy and runs it after each backup that succeeded and from a
daily timer, under the backups' lock. Standard library only.

Each run writes under a prefix of its own, `<run>/`, the time it started
(`2026-11-23T021500Z`), so no key is ever written twice:

- the repository's files the copy does not hold yet, or holds in another
  size or content (backup.info and the manifests, which pgBackRest
  rewrites, are copied as each run finds them), or holds from more than
  PEAL_BACKUP_COPY_REFRESH_DAYS ago (so what the repository still holds is
  never older in the copy than its lifecycle rule keeps);
- last, `<run>/index.json`: every file of the repository as the run found
  it, and the key of its copy, which may be an earlier run's. A run with an
  index is complete, and the index is what `rebuild` restores from.

A run that finds the repository as the last index left it writes nothing.
It refuses a run prefix that holds anything already. Every PUT carries
If-None-Match: *, which the store refuses on an existing key.

  peal-backup-copy copy                     one run
  peal-backup-copy runs                     the complete runs, newest last
  peal-backup-copy rebuild --run <run> --to-path <path>
                                            writes the run's set into the
                                            backup bucket under a new path

Settings come from the environment (the systemd unit): the endpoint, the
buckets, the repository's path, the collector's address. The keys come
from PEAL_BACKUP_COPY_CREDENTIALS (credentials.env), read by name, never
from the command line, and are never printed. The files are those
pgBackRest encrypted before they left the host: the copy needs no
passphrase, and cannot read them.
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import hmac
import http.client
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ElementTree
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

RUN = re.compile(r"^(\d{4}-\d{2}-\d{2}T\d{6}Z)/(.+)$")
INDEX = "index.json"
S3 = "{http://s3.amazonaws.com/doc/2006-03-01/}"
CHUNK = 1024 * 1024


class CopyError(Exception):
    """A failure the run reports in words of its own, never a secret."""


@dataclass(frozen=True)
class Bucket:
    """A bucket on an S3 API, with its key."""

    endpoint: str
    region: str
    name: str
    access_key: str
    secret_key: str

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
        canonical_query = "&".join(
            f"{urllib.parse.quote(name, safe='-_.~')}={urllib.parse.quote(value, safe='-_.~')}"
            for name, value in sorted(query.items())
        )
        canonical = "\n".join([
            method,
            urllib.parse.quote(path, safe="/-_.~"),
            canonical_query,
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
            target += "?" + "&".join(
                f"{urllib.parse.quote(name, safe='-_.~')}={urllib.parse.quote(value, safe='-_.~')}"
                for name, value in sorted(query.items())
            )
        connection.request(method, target, body=body, headers=signed)
        return connection.getresponse()

    def call(self, method: str, key: str = "", expect: tuple[int, ...] = (200,), **options: object) -> bytes:
        response = self.request(method, key, **options)  # type: ignore[arg-type]
        data = response.read()
        if response.status not in expect:
            code = re.search(rb"<Code>([^<]+)</Code>", data)
            raise CopyError(
                f"{method} on {self.name}/{key} answered {response.status}"
                + (f" ({code.group(1).decode()})" if code else "")
            )
        return data

    def list(self, prefix: str = "") -> Iterator[tuple[str, int, str]]:
        """Every object under the prefix: its key, size and ETag."""
        token: str | None = None
        while True:
            query = {"list-type": "2", "prefix": prefix}
            if token:
                query["continuation-token"] = token
            tree = ElementTree.fromstring(self.call("GET", query=query))
            for item in tree.iter(f"{S3}Contents"):
                yield (
                    item.findtext(f"{S3}Key") or "",
                    int(item.findtext(f"{S3}Size") or "0"),
                    (item.findtext(f"{S3}ETag") or "").strip('"'),
                )
            if tree.findtext(f"{S3}IsTruncated") != "true":
                return
            token = tree.findtext(f"{S3}NextContinuationToken")

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


def copy_object(source: Bucket, key: str, target: Bucket, to: str, size: int, part_size: int) -> str:
    """Streams one object from a bucket into a new key of another."""
    response = source.request("GET", key)
    if response.status != 200:
        response.read()
        raise CopyError(f"GET of {source.name}/{key} answered {response.status}")
    length = int(response.getheader("Content-Length") or "-1")
    if length != size:
        response.read()
        raise CopyError(f"{source.name}/{key} changed while it was copied")
    return target.put_new(to, response, size, part_size)


def _same(size: int, etag: str, copy_size: int, copy_etag: str) -> bool:
    """Whether a copy holds the source's content: the same size, and the
    same ETag unless one was written in parts, whose ETag is no digest."""
    multipart = "-" in etag or "-" in copy_etag
    return size == copy_size and (multipart or etag == copy_etag)


def _run_time(run: str) -> datetime.datetime:
    return datetime.datetime.strptime(run, "%Y-%m-%dT%H%M%SZ").replace(tzinfo=datetime.UTC)


@dataclass(frozen=True)
class Settings:
    source: Bucket
    copy: Bucket
    path: str
    refresh_days: int
    part_size: int

    @property
    def prefix(self) -> str:
        """The repository's keys start with its path, without the leading
        slash pgBackRest takes it with."""
        path = self.path.strip("/")
        return f"{path}/" if path else ""


def copy(settings: Settings, now: datetime.datetime | None = None) -> tuple[str | None, int]:
    """One run: the run's name and how many files it wrote, or None and 0
    when the copy already matched the repository."""
    now = now or datetime.datetime.now(datetime.UTC)
    run = now.strftime("%Y-%m-%dT%H%M%SZ")
    source = {
        key.removeprefix(settings.prefix): (size, etag)
        for key, size, etag in settings.source.list(settings.prefix)
    }
    copies: dict[str, list[tuple[str, int, str]]] = {}
    runs: set[str] = set()
    for key, size, etag in settings.copy.list():
        found = RUN.match(key)
        if not found:
            continue
        if found.group(1) == run:
            raise CopyError(f"the copy already holds a run {run}")
        if found.group(2) == INDEX:
            runs.add(found.group(1))
        else:
            copies.setdefault(found.group(2), []).append((found.group(1), size, etag))

    fresh_after = now - datetime.timedelta(days=settings.refresh_days)
    index: dict[str, dict[str, object]] = {}
    todo: list[str] = []
    for key, (size, etag) in sorted(source.items()):
        held = [
            (copied, copy_size)
            for copied, copy_size, copy_etag in copies.get(key, [])
            if _same(size, etag, copy_size, copy_etag) and _run_time(copied) > fresh_after
        ]
        if held:
            copied, _ = max(held)
            index[key] = {"copy": f"{copied}/{key}", "size": size}
        else:
            todo.append(key)

    latest = max(runs) if runs else None
    if not todo and latest is not None:
        previous = json.loads(settings.copy.call("GET", f"{latest}/{INDEX}"))
        if previous.get("objects") == index:
            return None, 0

    for key in todo:
        size, _ = source[key]
        copy_object(settings.source, settings.prefix + key, settings.copy, f"{run}/{key}", size, settings.part_size)
        index[key] = {"copy": f"{run}/{key}", "size": size}

    document = json.dumps(
        {"run": run, "source": {"bucket": settings.source.name, "path": settings.path}, "objects": index},
        indent=1, sort_keys=True,
    ).encode()
    settings.copy.put_new(f"{run}/{INDEX}", document, len(document), settings.part_size)
    return run, len(todo) + 1


def complete_runs(copy_bucket: Bucket) -> list[str]:
    return sorted(
        found.group(1) for key, _, _ in copy_bucket.list() if (found := RUN.match(key)) and found.group(2) == INDEX
    )


def rebuild(settings: Settings, run: str, to_path: str) -> list[str]:
    """Writes the run's set under a new path of the backup bucket, which
    must hold nothing: the keys its index names whose copy is gone (the
    copy's lifecycle rule), which it could not write."""
    target = to_path.strip("/")
    if not target or f"{target}/" == settings.prefix:
        raise CopyError("rebuild into a new path, never the repository's own")
    if next(iter(settings.source.list(f"{target}/")), None) is not None:
        raise CopyError(f"{target}/ already holds files")
    if not RUN.match(f"{run}/{INDEX}"):
        raise CopyError(f"{run} is no run")
    index = json.loads(settings.copy.call("GET", f"{run}/{INDEX}"))
    held = {key for key, _, _ in settings.copy.list()}
    missing: list[str] = []
    for key, entry in sorted(index["objects"].items()):
        if entry["copy"] not in held:
            missing.append(key)
            continue
        copy_object(settings.copy, entry["copy"], settings.source, f"{target}/{key}", entry["size"], settings.part_size)
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
        part_size=int(environ.get("PEAL_BACKUP_COPY_PART_SIZE", str(256 * 1024 * 1024))),
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
        except (urllib.error.URLError, OSError):
            if attempt == retries:
                print(f"peal-backup-copy: the collector did not record {name}", file=sys.stderr)
                return
            time.sleep(delay)


def main(argv: list[str] | None = None, environ: dict[str, str] | None = None) -> int:
    environ = dict(os.environ if environ is None else environ)
    parser = argparse.ArgumentParser(prog="peal-backup-copy")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("copy")
    commands.add_parser("runs")
    rebuilding = commands.add_parser("rebuild")
    rebuilding.add_argument("--run", required=True)
    rebuilding.add_argument("--to-path", required=True)
    arguments = parser.parse_args(argv)
    try:
        settings = settings_from(environ)
        if arguments.command == "runs":
            print("\n".join(complete_runs(settings.copy)))
            return 0
        if arguments.command == "rebuild":
            missing = rebuild(settings, arguments.run, arguments.to_path)
            for key in missing:
                print(f"missing {key}")
            print(f"rebuilt {arguments.run} under {arguments.to_path.strip('/')}/, {len(missing)} missing")
            return 1 if missing else 0
        run, written = copy(settings)
        print(f"copied run {run}, {written} files" if run else "the copy is up to date")
    except (CopyError, OSError, KeyError, ValueError, ElementTree.ParseError) as error:
        # A missing setting names itself; any other error says its kind
        # alone, never a value it may carry.
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
