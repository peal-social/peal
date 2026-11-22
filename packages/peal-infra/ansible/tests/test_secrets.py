"""The secrets peal_runtime generates on the server (secrets.env)."""

from __future__ import annotations

import base64
import re
import stat
import subprocess
from pathlib import Path

from conftest import render, task


def _generate(root: Path) -> dict[str, str]:
    """Runs the role's generation, as root would on the server, in root."""
    found = task("peal_runtime", "Generate the secrets")
    script = render(found["ansible.builtin.shell"], peal_root=str(root))
    subprocess.run(["sh", "-c", script], check=True)
    secrets = root / "secrets.env"

    assert stat.S_IMODE(secrets.stat().st_mode) == 0o600

    return dict(line.split("=", 1) for line in secrets.read_text().splitlines())


def test_every_secret_is_set(tmp_path: Path) -> None:
    secrets = _generate(tmp_path)

    assert sorted(secrets) == [
        "BETTER_AUTH_SECRET",
        "GRAFANA_ADMIN_PASSWORD",
        "PEAL_TOKEN_KEYS",
        "POSTGRES_PASSWORD",
    ]
    # Part of DATABASE_URL, so URL-safe.
    assert re.fullmatch(r"[0-9a-f]{64}", secrets["POSTGRES_PASSWORD"])


def test_the_token_key_is_one_the_server_reads(tmp_path: Path) -> None:
    key_id, key = _generate(tmp_path)["PEAL_TOKEN_KEYS"].split(":", 1)

    # web-crypto-token-cipher.ts: keyIdPattern, and an AES-256 key.
    assert re.fullmatch(r"[\w-]{1,64}", key_id)
    assert len(base64.b64decode(key)) == 32


def test_each_server_names_its_token_key_apart(tmp_path: Path) -> None:
    """A server rebuilt from a backup gets a new key. Named like the old
    one, which the restored tokens name, it would be tried on them and fail
    as tampering (TokenAuthenticationFailed) rather than as a key the server
    does not have (UnknownTokenKey), even when both servers were set up the
    same day."""
    servers = [tmp_path / "first", tmp_path / "second"]
    for server in servers:
        server.mkdir()

    key_ids = {_generate(server)["PEAL_TOKEN_KEYS"].split(":")[0] for server in servers}

    assert len(key_ids) == len(servers)


def test_the_server_s_database_password_is_added_once(tmp_path: Path) -> None:
    """A server set up before its database role gets the role's password,
    URL-safe as DATABASE_URL needs it, and keeps it at the next run."""
    _generate(tmp_path)
    found = task("peal_runtime", "Generate the server's database password")
    script = render(found["ansible.builtin.shell"], peal_root=str(tmp_path))
    secrets_env = tmp_path / "secrets.env"

    first = subprocess.run(["sh", "-c", script], capture_output=True, text=True, check=True)
    added = secrets_env.read_text()
    second = subprocess.run(["sh", "-c", script], capture_output=True, text=True, check=True)

    assert (first.stdout.strip(), second.stdout.strip()) == ("added", "")
    assert secrets_env.read_text() == added
    assert stat.S_IMODE(secrets_env.stat().st_mode) == 0o600
    password = dict(line.split("=", 1) for line in added.splitlines())["PEAL_DATABASE_PASSWORD"]
    assert re.fullmatch(r"[0-9a-f]{64}", password)
