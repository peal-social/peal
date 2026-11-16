"""The configuration the stack mounts from the release folder reaches its
services: Compose compares a service's definition, whose mounts name
/srv/peal/current/… whatever release that points at, so the release hashes
the files each service mounts (roles/peal_release/files/config_hashes.py)
into release.env, and each such service carries its hash as a label.
Compose then recreates the services whose files changed, and those alone,
when a release, a second one of the same commit or a roll-back runs."""

from __future__ import annotations

import copy
import importlib.util
import json
import re
import secrets
import shutil
import subprocess
import sys
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType
from typing import Any

import jinja2
import pytest
import yaml

from conftest import INFRA, committed_inventory, recap_of, task

SCRIPT = INFRA / "roles" / "peal_release" / "files" / "config_hashes.py"
DOCKER = INFRA.parent.parent / "peal-docker"
LABEL = "social.peal.config-hash"

HASH = "Hash the files each service mounts from the release"
NAME = "Name the release that runs"
POINT = "Point current at the release"
START = "Start the rest of the stack"

# The collector's busybox, already pulled for the stack and its tests.
BUSYBOX = next(
    line.split("image: ", 1)[1].strip()
    for line in (DOCKER / "compose.production.yaml").read_text().splitlines()
    if "image: busybox:" in line
)


def _load() -> ModuleType:
    spec = importlib.util.spec_from_file_location("config_hashes", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["config_hashes"] = module
    spec.loader.exec_module(module)
    return module


config_hashes = _load()


def _bind(source: Path | str, target: str) -> dict[str, Any]:
    return {"type": "bind", "source": str(source), "target": target, "read_only": True}


def _release(folder: Path, files: dict[str, str]) -> Path:
    for name, text in files.items():
        path = folder / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    return folder


# What `docker compose config --format json` gives of the stack's mounts.
def _config(release: Path) -> dict[str, Any]:
    return {
        "services": {
            "grafana": {
                "volumes": [
                    _bind(release / "config/rules.yaml", "/etc/grafana/rules.yaml"),
                    _bind(release / "config/dashboards", "/etc/grafana/dashboards"),
                    {"type": "volume", "source": "grafana", "target": "/var/lib/grafana"},
                ]
            },
            "otel-collector": {
                "volumes": [
                    _bind(release / "config/collector.yaml", "/etc/otelcol/config.yaml"),
                    _bind("/", "/hostfs"),
                ]
            },
            "server": {"volumes": [_bind("/srv/peal/privacy-declaration.json", "/etc/peal/declaration.json")]},
            "postgres": {"volumes": [{"type": "volume", "source": "postgres", "target": "/var/lib/postgresql"}]},
        }
    }


FILES = {
    "config/rules.yaml": "rules: [first]\n",
    "config/dashboards/one.json": "{}\n",
    "config/collector.yaml": "receivers: {}\n",
}


def test_each_service_that_mounts_release_files_gets_a_hash_of_its_own(tmp_path: Path) -> None:
    release = _release(tmp_path / "a", FILES)

    hashes = config_hashes.hashes(_config(release), release)

    assert sorted(hashes) == ["PEAL_GRAFANA_CONFIG_HASH", "PEAL_OTEL_COLLECTOR_CONFIG_HASH"]
    assert all(re.fullmatch(r"[0-9a-f]{16}", value) for value in hashes.values())


def test_the_same_files_in_another_release_hash_the_same(tmp_path: Path) -> None:
    first = _release(tmp_path / "a", FILES)
    second = _release(tmp_path / "b", FILES)

    assert config_hashes.hashes(_config(first), first) == config_hashes.hashes(_config(second), second)


@pytest.mark.parametrize(
    "changed",
    [
        {"config/rules.yaml": "rules: [first, second]\n"},
        {"config/dashboards/one.json": '{"title": "changed"}\n'},
        {"config/dashboards/two.json": "{}\n"},
    ],
)
def test_a_changed_file_changes_its_service_s_hash_alone(tmp_path: Path, changed: dict[str, str]) -> None:
    first = _release(tmp_path / "a", FILES)
    second = _release(tmp_path / "b", {**FILES, **changed})

    before = config_hashes.hashes(_config(first), first)
    after = config_hashes.hashes(_config(second), second)

    assert after["PEAL_GRAFANA_CONFIG_HASH"] != before["PEAL_GRAFANA_CONFIG_HASH"]
    assert after["PEAL_OTEL_COLLECTOR_CONFIG_HASH"] == before["PEAL_OTEL_COLLECTOR_CONFIG_HASH"]


def test_a_file_moved_to_another_name_changes_the_hash(tmp_path: Path) -> None:
    first = _release(tmp_path / "a", FILES)
    moved = {**FILES, "config/dashboards/renamed.json": "{}\n"}
    del moved["config/dashboards/one.json"]
    second = _release(tmp_path / "b", moved)

    assert (
        config_hashes.hashes(_config(second), second)["PEAL_GRAFANA_CONFIG_HASH"]
        != config_hashes.hashes(_config(first), first)["PEAL_GRAFANA_CONFIG_HASH"]
    )


def test_a_missing_source_hashes_apart_from_an_empty_file(tmp_path: Path) -> None:
    empty = _release(tmp_path / "a", {**FILES, "config/collector.yaml": ""})
    missing = _release(tmp_path / "b", FILES)
    (missing / "config/collector.yaml").unlink()

    assert (
        config_hashes.hashes(_config(missing), missing)["PEAL_OTEL_COLLECTOR_CONFIG_HASH"]
        != config_hashes.hashes(_config(empty), empty)["PEAL_OTEL_COLLECTOR_CONFIG_HASH"]
    )


# Every service of the stacks that mounts a file or folder of the stack's
# folder ('./…', or a setting's './…' default) carries its hash as a label,
# or Compose never sees that file change.
def _mounts_release_files(service: dict[str, Any]) -> bool:
    return any(
        isinstance(volume, str) and re.match(r"(\./|\$\{[A-Z0-9_]+:-\./)", volume)
        for volume in service.get("volumes", [])
    )


SERVICES = [
    (file, name, service)
    for file in ("compose.production.yaml", "compose.self-host.yaml")
    for name, service in yaml.safe_load((DOCKER / file).read_text())["services"].items()
]


def test_the_stack_s_services_mount_files_of_the_release() -> None:
    assert {name for _file, name, service in SERVICES if _mounts_release_files(service)} >= {
        "server",
        "otel-collector",
        "loki",
        "tempo",
        "prometheus",
        "grafana",
        "caddy",
    }


@pytest.mark.parametrize(
    ("file", "name", "service"),
    [(file, name, service) for file, name, service in SERVICES if _mounts_release_files(service)],
    ids=lambda value: value if isinstance(value, str) else "",
)
def test_each_service_that_mounts_release_files_carries_its_hash(file: str, name: str, service: dict[str, Any]) -> None:
    assert (service.get("labels") or {}).get(LABEL) == "${" + config_hashes.variable(name) + ":-}", file


def test_services_that_mount_none_carry_no_hash() -> None:
    assert [name for _file, name, service in SERVICES if not _mounts_release_files(service) and LABEL in (service.get("labels") or {})] == []


def test_the_hashes_are_read_after_the_upload_and_before_release_env() -> None:
    names = [found["name"] for found in yaml.safe_load((INFRA / "roles" / "peal_release" / "tasks" / "main.yml").read_text())]

    assert names.index("Upload the stack's files") < names.index(HASH) < names.index(NAME)


# --- With Docker: the release's own tasks, on a stack of three services.


def _docker_runs() -> bool:
    return (
        shutil.which("docker") is not None
        and subprocess.run(["docker", "info"], capture_output=True, check=False).returncode == 0
    )


docker = pytest.mark.skipif(not _docker_runs(), reason="Docker is not running")

# The stack: Grafana's and Loki's stand-ins mount files of the release, and
# Postgres's mounts none, as in compose.production.yaml. Each holds the
# required setting secrets.env gives, as the stack does.
COMPOSE = f"""\
x-service: &service
  image: {BUSYBOX}
  command: [sleep, "3600"]
  init: true
  environment:
    POSTGRES_PASSWORD: ${{POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}}

services:
  postgres:
    <<: *service
  loki:
    <<: *service
    labels:
      {LABEL}: ${{PEAL_LOKI_CONFIG_HASH:-}}
    volumes:
      - ./config/loki.yaml:/etc/loki/config.yaml:ro
  grafana:
    <<: *service
    labels:
      {LABEL}: ${{PEAL_GRAFANA_CONFIG_HASH:-}}
    volumes:
      - ./config/grafana/alerting/rules.yaml:/etc/grafana/provisioning/alerting/rules.yaml:ro
      - ./config/grafana/dashboards:/etc/grafana/dashboards:ro
      - ${{PEAL_GRAFANA_CONTACT_POINTS:-./config/grafana/alerting/none.yaml}}:/etc/grafana/provisioning/alerting/contact-points.yaml:ro
"""

RULES = "groups:\n  - name: peal\n    rules:\n      - uid: peal-synthetic-rule\n"
STACK = {
    "compose.production.yaml": COMPOSE,
    "config/loki.yaml": "auth_enabled: false\n",
    "config/grafana/alerting/rules.yaml": RULES,
    "config/grafana/alerting/none.yaml": "apiVersion: 1\n",
    "config/grafana/alerting/telegram.yaml": "apiVersion: 1\ncontactPoints: []\n",
    "config/grafana/dashboards/peal.json": "{}\n",
}


def _play(folder: Path, names: list[str], **settings: Any) -> subprocess.CompletedProcess[str]:
    """Runs the role's tasks as play_tasks does, as this user: without the
    files' owner and group (root on a server), and with the role's script
    where a play finds it, in files/ beside it."""
    (folder / "files").mkdir(exist_ok=True)
    shutil.copy(SCRIPT, folder / "files" / SCRIPT.name)
    tasks = []
    for name in names:
        found = copy.deepcopy(task("peal_release", name))
        for module in ("ansible.builtin.copy", "ansible.builtin.file"):
            for key in ("owner", "group"):
                found.get(module, {}).pop(key, None)
        tasks.append(found)
    play = {
        "name": "Run tasks of the peal_release role",
        "hosts": "peal-production",
        "gather_facts": False,
        "connection": "local",
        "vars": {"ansible_python_interpreter": "{{ ansible_playbook_python }}", **settings},
        "tasks": tasks,
    }
    playbook = folder / "tasks.yml"
    playbook.write_text(yaml.safe_dump([play], sort_keys=False))
    return subprocess.run(
        [str(Path(sys.executable).parent / "ansible-playbook"), "--inventory", committed_inventory(), str(playbook)],
        cwd=INFRA,
        check=False,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
    )


@dataclass(frozen=True)
class Server:
    """A server's /srv/peal in the test's folder, with its peal-compose."""

    root: Path
    project: str

    def release(self, commit: str, files: dict[str, str]) -> dict[str, int]:
        """Uploads a release folder as release.yml does, then runs the
        release's tasks from the hashes to the stack's start."""
        folder = self.root / "releases" / commit
        if not folder.exists():
            _release(folder, files)
        ran = _play(
            self.root.parent,
            [HASH, NAME, POINT, START],
            peal_root=str(self.root),
            peal_compose_bin=str(self.root / "peal-compose"),
            peal_release_dir=str(folder),
            peal_release_tag=commit,
            peal_release_postgres_tag="synthetic",
            peal_release_files={"changed": True},
        )
        assert ran.returncode == 0, ran.stdout + ran.stderr
        return recap_of(ran)

    def container(self, service: str) -> str:
        return subprocess.run(
            ["docker", "inspect", "--format", "{{.Id}}", f"{self.project}-{service}-1"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()

    def containers(self) -> dict[str, str]:
        return {service: self.container(service) for service in ("postgres", "loki", "grafana")}

    def read(self, service: str, path: str) -> str:
        return subprocess.run(
            ["docker", "exec", f"{self.project}-{service}-1", "cat", path],
            capture_output=True,
            text=True,
            check=True,
        ).stdout


@pytest.fixture
def server(tmp_path: Path) -> Iterator[Server]:
    root = tmp_path / "peal"
    (root / "releases").mkdir(parents=True)
    project = f"peal-config-{secrets.token_hex(4)}"
    (root / "host.env").write_text("PUBLIC_URL='https://app.example.test'\n")
    (root / "credentials.env").write_text("")
    (root / "secrets.env").write_text("POSTGRES_PASSWORD=synthetic-password\n")
    compose = root / "peal-compose"
    # As the template module renders it, which trims a block's line.
    template = jinja2.Environment(trim_blocks=True, undefined=jinja2.StrictUndefined, autoescape=False)
    compose.write_text(
        template.from_string((INFRA / "roles" / "peal_runtime" / "templates" / "peal-compose.j2").read_text()).render(
            peal_compose_project=project,
            peal_root=str(root),
            peal_compose_profiles=[],
        )
    )
    compose.chmod(0o755)
    try:
        yield Server(root, project)
    finally:
        subprocess.run(
            [str(compose), "down", "--timeout", "0", "--remove-orphans"],
            capture_output=True,
            check=False,
        )


@docker
def test_a_changed_rules_file_recreates_grafana_alone(server: Server) -> None:
    server.release("aaaaaaaaaaaa", STACK)
    before = server.containers()

    changed = RULES + "      - uid: peal-sign-in-provider-unavailable\n"
    server.release("bbbbbbbbbbbb", {**STACK, "config/grafana/alerting/rules.yaml": changed})
    after = server.containers()

    assert after["grafana"] != before["grafana"]
    assert {service: after[service] == before[service] for service in ("postgres", "loki")} == {"postgres": True, "loki": True}
    assert "peal-sign-in-provider-unavailable" in server.read("grafana", "/etc/grafana/provisioning/alerting/rules.yaml")


@docker
def test_an_unchanged_rules_file_recreates_nothing(server: Server) -> None:
    server.release("aaaaaaaaaaaa", STACK)
    before = server.containers()

    recap = server.release("bbbbbbbbbbbb", STACK)

    assert server.containers() == before
    # release.env's new tag and current's link, and not the stack's start.
    assert recap["changed"] == 2


@docker
def test_a_second_release_of_the_same_commit_changes_nothing(server: Server) -> None:
    server.release("aaaaaaaaaaaa", STACK)
    before = server.containers()

    recap = server.release("aaaaaaaaaaaa", STACK)

    assert recap["changed"] == 0
    assert server.containers() == before


@docker
def test_a_roll_back_restores_the_older_rules(server: Server) -> None:
    server.release("aaaaaaaaaaaa", STACK)
    first = server.containers()
    changed = RULES + "      - uid: peal-sign-in-provider-unavailable\n"
    server.release("bbbbbbbbbbbb", {**STACK, "config/grafana/alerting/rules.yaml": changed})

    server.release("aaaaaaaaaaaa", STACK)
    rolled_back = server.containers()

    assert rolled_back["grafana"] != first["grafana"]
    assert rolled_back["postgres"] == first["postgres"]
    assert "peal-sign-in-provider-unavailable" not in server.read("grafana", "/etc/grafana/provisioning/alerting/rules.yaml")


@docker
def test_a_file_host_env_names_counts_as_the_service_s_own(server: Server) -> None:
    server.release("aaaaaaaaaaaa", STACK)
    before = server.containers()
    with (server.root / "host.env").open("a") as host_env:
        host_env.write("PEAL_GRAFANA_CONTACT_POINTS='./config/grafana/alerting/telegram.yaml'\n")

    server.release("aaaaaaaaaaaa", STACK)

    assert server.container("grafana") != before["grafana"]
    assert server.container("loki") == before["loki"]
    assert "contactPoints" in server.read("grafana", "/etc/grafana/provisioning/alerting/contact-points.yaml")


@docker
def test_the_script_prints_hashes_and_no_setting(server: Server) -> None:
    folder = _release(server.root / "releases" / "aaaaaaaaaaaa", STACK)

    ran = subprocess.run(
        [sys.executable, str(SCRIPT), str(folder), *(str(server.root / name) for name in ("host.env", "credentials.env", "secrets.env"))],
        capture_output=True,
        text=True,
        check=True,
    )

    assert sorted(json.loads(ran.stdout)) == ["PEAL_GRAFANA_CONFIG_HASH", "PEAL_LOKI_CONFIG_HASH"]
    assert "synthetic-password" not in ran.stdout + ran.stderr
