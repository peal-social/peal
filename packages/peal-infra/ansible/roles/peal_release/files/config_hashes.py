"""Prints, as JSON, a hash of the files each service of a release's stack
mounts from the release folder: {"PEAL_<SERVICE>_CONFIG_HASH": "…"}.

Compose recreates a container when the service's definition changes, and a
mount names /srv/peal/current/…, which reads the same whatever release that
points at: a changed alert rule or dashboard would never reach Grafana. The
release writes these hashes into release.env, and each such service carries
its own as a label (`social.peal.config-hash`), so Compose recreates exactly
the services whose files changed, a roll-back included.

    config_hashes.py <release folder> [--env-file <file>]… [--profile <name>]…

Compose reads the release's compose.production.yaml with the env files and
the profiles the server runs, as peal-compose does, and resolves each
mount's source, a setting's included (host.env's
PEAL_GRAFANA_CONTACT_POINTS). Its output holds the settings, secrets among
them, and so may its errors, which quote a malformed value: both stay in
this process. Only the hashes are printed, or, when Compose fails, words of
the script's own and the names of the settings Compose found missing. A
stack in which no service mounts a file of the release fails too: every
label would be empty, and no change would reach a service. Standard
library only: it runs with the server's Python, which Ansible uses."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

# Compose's own words for a required setting that is unset or empty: the
# setting's name, never a value.
_MISSING = re.compile(r"required variable ([A-Za-z_][A-Za-z0-9_]*) is missing a value")


def variable(service: str) -> str:
    """The release.env setting that holds a service's hash."""
    return "PEAL_" + re.sub(r"[^A-Z0-9]", "_", service.upper()) + "_CONFIG_HASH"


def _files(source: Path) -> list[Path]:
    if source.is_dir():
        return sorted(path for path in source.rglob("*") if path.is_file())
    return [source]


def _digest(sources: list[Path], release: Path) -> str:
    """Each mounted file's path in the release and its content; a source the
    release lacks counts as missing, apart from an empty file."""
    digest = hashlib.sha256()
    for source in sources:
        for path in _files(source):
            digest.update(str(path.relative_to(release)).encode() + b"\0")
            if path.is_file():
                digest.update(hashlib.sha256(path.read_bytes()).digest())
            else:
                digest.update(b"missing")
            digest.update(b"\0")
    return digest.hexdigest()[:16]


def _in_release(source: str, release: Path) -> Path | None:
    """The source, resolved, when it is in the release folder: the same
    folder spelt another way, or through a link, counts."""
    if not source:
        return None
    path = Path(source).resolve()
    return path if path.is_relative_to(release) else None


def hashes(config: dict[str, Any], release: Path) -> dict[str, str]:
    """The hash of each service that mounts files of the release folder,
    from what `docker compose config --format json` gives."""
    folder = release.resolve()
    found: dict[str, str] = {}
    for name, service in sorted(config.get("services", {}).items()):
        sources = [
            path
            for volume in service.get("volumes") or []
            if volume.get("type") == "bind"
            and (path := _in_release(volume.get("source", ""), folder)) is not None
        ]
        if sources:
            found[variable(name)] = _digest(sources, folder)
    return found


def _arguments(arguments: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Hashes the files each service mounts from a release folder.")
    parser.add_argument("release", type=Path)
    parser.add_argument("--env-file", action="append", default=[], dest="env_files")
    parser.add_argument("--profile", action="append", default=[], dest="profiles")
    return parser.parse_args(arguments)


def main(arguments: list[str]) -> int:
    options = _arguments(arguments)
    folder = options.release.resolve()
    command = [
        "docker",
        "compose",
        "--project-directory",
        str(folder),
        "--file",
        str(folder / "compose.production.yaml"),
        *[part for env_file in options.env_files for part in ("--env-file", env_file)],
        *[part for profile in options.profiles for part in ("--profile", profile)],
        "config",
        "--format",
        "json",
    ]
    ran = subprocess.run(command, capture_output=True, text=True, check=False)
    if ran.returncode != 0:
        missing = sorted(set(_MISSING.findall(ran.stderr)))
        sys.stderr.write(
            "docker compose config failed on the release's Compose file and env files;"
            " run `sudo peal-compose config --quiet` on the server to see why.\n"
        )
        if missing:
            sys.stderr.write("Missing settings: " + ", ".join(missing) + "\n")
        return 1
    found = hashes(json.loads(ran.stdout), folder)
    if not found:
        sys.stderr.write(f"no service mounts files of the release folder {folder}: no hash to write.\n")
        return 1
    print(json.dumps(found, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
