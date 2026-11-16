"""Prints, as JSON, a hash of the files each service of a release's stack
mounts from the release folder: {"PEAL_<SERVICE>_CONFIG_HASH": "…"}.

Compose recreates a container when the service's definition changes, and a
mount names /srv/peal/current/…, which reads the same whatever release that
points at: a changed alert rule or dashboard would never reach Grafana. The
release writes these hashes into release.env, and each such service carries
its own as a label (`social.peal.config-hash`), so Compose recreates exactly
the services whose files changed, a roll-back included.

    config_hashes.py <release folder> <env file>…

Compose reads the release's compose.production.yaml with the env files, as
peal-compose does, every profile included, and resolves each mount's
source, a setting's included (host.env's PEAL_GRAFANA_CONTACT_POINTS). Its
output holds the settings, secrets among them: it stays in this process,
and only the hashes are printed. Standard library only: it runs with the
server's Python, which Ansible uses."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


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
    path = Path(source)
    return path if path.is_relative_to(release) else None


def hashes(config: dict[str, Any], release: Path) -> dict[str, str]:
    """The hash of each service that mounts files of the release folder,
    from what `docker compose config --format json` gives."""
    found: dict[str, str] = {}
    for name, service in sorted(config.get("services", {}).items()):
        sources = [
            path
            for volume in service.get("volumes") or []
            if volume.get("type") == "bind"
            and (path := _in_release(volume.get("source", ""), release)) is not None
        ]
        if sources:
            found[variable(name)] = _digest(sources, release)
    return found


def main(arguments: list[str]) -> int:
    release, *env_files = arguments
    folder = Path(release)
    command = [
        "docker",
        "compose",
        "--project-directory",
        str(folder),
        "--file",
        str(folder / "compose.production.yaml"),
        *[part for env_file in env_files for part in ("--env-file", env_file)],
        "--profile",
        "*",
        "config",
        "--format",
        "json",
    ]
    ran = subprocess.run(command, capture_output=True, text=True, check=False)
    if ran.returncode != 0:
        # Compose names a missing setting, never a value.
        sys.stderr.write(ran.stderr)
        return ran.returncode
    print(json.dumps(hashes(json.loads(ran.stdout), folder), sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
