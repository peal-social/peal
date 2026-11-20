"""scripts/vault-pass-client.py with a stand-in for `pass-cli`: which Proton
Pass item and field it asks for, and what Ansible gets back."""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from typing import Any

import pytest
from conftest import INFRA

_spec = importlib.util.spec_from_file_location("vault_pass_client", INFRA / "scripts" / "vault-pass-client.py")
assert _spec is not None and _spec.loader is not None
client = importlib.util.module_from_spec(_spec)
sys.modules["vault_pass_client"] = client
_spec.loader.exec_module(client)


class Pass:
    """Answers `pass-cli item view` from a dict keyed by (vault, item, field),
    and keeps the commands it was given and what it read them from."""

    def __init__(self, items: dict[tuple[str, str, str], bytes]) -> None:
        self.items = items
        self.commands: list[list[str]] = []
        self.stdins: list[Any] = []

    def __call__(self, command: list[str], **options: Any) -> subprocess.CompletedProcess[bytes]:
        self.commands.append(command)
        self.stdins.append(options.get("stdin"))
        key = (
            command[command.index("--vault-name") + 1],
            command[command.index("--item-title") + 1],
            command[command.index("--field") + 1],
        )
        if key not in self.items:
            return subprocess.CompletedProcess(command, 1, b"", b"Item not found")
        return subprocess.CompletedProcess(command, 0, self.items[key] + b"\n", b"")


SANDBOX = ("Peal", "Ansible vault · sandbox", "ANSIBLE_VAULT_PASSWORD")


@pytest.fixture(autouse=True)
def _default_vault(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PEAL_PASS_VAULT", raising=False)


def test_it_prints_the_password_of_the_vault_ansible_names(capsysbinary: pytest.CaptureFixture[bytes]) -> None:
    proton = Pass({SANDBOX: b"synthetic-sandbox-password"})

    assert client.main(["--vault-id", "sandbox"], run=proton) == 0

    assert capsysbinary.readouterr().out == b"synthetic-sandbox-password\n"
    assert proton.commands == [
        [
            "pass-cli",
            "item",
            "view",
            "--vault-name",
            "Peal",
            "--item-title",
            "Ansible vault · sandbox",
            "--field",
            "ANSIBLE_VAULT_PASSWORD",
        ]
    ]
    assert proton.stdins == [subprocess.DEVNULL]


def test_the_proton_pass_vault_can_be_named(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PEAL_PASS_VAULT", "Peal infra")
    proton = Pass({("Peal infra", "Ansible vault · sandbox", "ANSIBLE_VAULT_PASSWORD"): b"synthetic-sandbox-password"})

    assert client.main(["--vault-id", "sandbox"], run=proton) == 0


def test_an_unknown_vault_is_exit_code_2_with_no_password(capsysbinary: pytest.CaptureFixture[bytes]) -> None:
    proton = Pass({SANDBOX: b"synthetic-sandbox-password"})

    assert client.main(["--vault-id", "production"], run=proton) == 2

    printed = capsysbinary.readouterr()
    assert printed.out == b""
    assert "Ansible vault · production".encode() in printed.err
    assert b"synthetic-sandbox-password" not in printed.err


def test_without_pass_cli_it_is_exit_code_2(capsysbinary: pytest.CaptureFixture[bytes]) -> None:
    def missing(command: list[str], **_options: Any) -> subprocess.CompletedProcess[bytes]:
        raise FileNotFoundError(command[0])

    assert client.main(["--vault-id", "sandbox"], run=missing) == 2
    assert b"pass-cli" in capsysbinary.readouterr().err


def test_ansible_can_run_it() -> None:
    script = INFRA / "scripts" / "vault-pass-client.py"

    assert script.stat().st_mode & 0o111
    assert script.read_text().startswith("#!/usr/bin/env python3\n")
