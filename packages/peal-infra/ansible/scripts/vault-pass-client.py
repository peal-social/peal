#!/usr/bin/env python3
"""Ansible's vault password client on the owner's machine: prints the password
of the vault Ansible names, kept in Proton Pass as the field
`ANSIBLE_VAULT_PASSWORD` of the item `Ansible vault · <vault id>`, in the vault
`PEAL_PASS_VAULT` names (`Peal` unless set), and read with `pass-cli`
(README.md, "Credentials"):

    uv run ansible-playbook playbooks/site.yml --limit sandbox \\
      --vault-id sandbox@scripts/vault-pass-client.py

Ansible calls it with `--vault-id <id>`, as its name ends in `-client`.
`pass-cli login` comes first. It exits with 2 when Proton Pass has no such
item or `pass-cli` is not signed in, which Ansible reads as an unknown vault
id, and prints nothing Proton Pass answered.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from collections.abc import Callable

FIELD = "ANSIBLE_VAULT_PASSWORD"
DEFAULT_VAULT = "Peal"

Run = Callable[..., subprocess.CompletedProcess[bytes]]


def item_of(vault_id: str) -> str:
    return f"Ansible vault · {vault_id}"


def main(argv: list[str] | None = None, run: Run = subprocess.run) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--vault-id", required=True)
    options = parser.parse_args(argv)

    vault = os.environ.get("PEAL_PASS_VAULT") or DEFAULT_VAULT
    item = item_of(options.vault_id)
    try:
        found = run(
            ["pass-cli", "item", "view", "--vault-name", vault, "--item-title", item, "--field", FIELD],
            capture_output=True,
            stdin=subprocess.DEVNULL,
            check=False,
        )
    except FileNotFoundError:
        print("pass-cli is not installed (brew install proton-pass-cli).", file=sys.stderr)
        return 2
    if found.returncode != 0 or not found.stdout.strip():
        print(
            f'No field {FIELD} in "{item}" of the Proton Pass vault "{vault}", or pass-cli is not signed in '
            "(pass-cli login).",
            file=sys.stderr,
        )
        return 2
    sys.stdout.buffer.write(found.stdout.strip() + b"\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
