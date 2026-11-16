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

INSTALL = "Install the script that hashes the release's mounted files"
HASH = "Hash the files each service mounts from the release"
REPORT = "Report the hashes check mode could not read"
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

    assert names.index("Upload the stack's files") < names.index(INSTALL) < names.index(HASH) < names.index(REPORT) < names.index(NAME)


def test_the_hashes_are_read_with_the_command_module() -> None:
    """Over SSH, the script module runs in a pseudo-terminal, which has no
    stderr: a warning there would land in the JSON the release reads. The
    command module keeps the two apart."""
    found = task("peal_release", HASH)

    assert "ansible.builtin.command" in found
    assert "ansible.builtin.script" not in found


def test_the_hashes_are_read_for_the_profiles_the_server_runs() -> None:
    argv = task("peal_release", HASH)["ansible.builtin.command"]["argv"]

    assert "peal_compose_profiles" in argv
    assert "'*'" not in argv


# --- With Docker: the script on Compose, and the release's own tasks, on a
# stack of three services.


def _hash(release: Path | str, env_files: list[Path], *options: str, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    """Runs the script as the release does."""
    return subprocess.run(
        [sys.executable, str(SCRIPT), str(release), *[part for env in env_files for part in ("--env-file", str(env))], *options],
        capture_output=True,
        text=True,
        check=False,
        cwd=cwd,
    )


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


def _play(
    folder: Path,
    names: list[str],
    *,
    check: bool = False,
    environment: dict[str, str] | None = None,
    **settings: Any,
) -> subprocess.CompletedProcess[str]:
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
        "environment": environment or {},
        "tasks": tasks,
    }
    playbook = folder / "tasks.yml"
    playbook.write_text(yaml.safe_dump([play], sort_keys=False))
    return subprocess.run(
        [
            str(Path(sys.executable).parent / "ansible-playbook"),
            "--inventory",
            committed_inventory(),
            str(playbook),
            *(["--check"] if check else []),
        ],
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

    def release(
        self,
        commit: str,
        files: dict[str, str],
        *,
        environment: dict[str, str] | None = None,
    ) -> dict[str, int]:
        """Uploads a release folder as release.yml does, then runs the
        release's tasks from the hashes to the stack's start."""
        folder = self.root / "releases" / commit
        if not folder.exists():
            _release(folder, files)
        ran = _play(
            self.root.parent,
            [INSTALL, HASH, REPORT, NAME, POINT, START],
            environment=environment,
            **self.settings(folder, commit),
        )
        assert ran.returncode == 0, ran.stdout + ran.stderr
        return recap_of(ran)

    def settings(self, folder: Path, commit: str) -> dict[str, Any]:
        return {
            "peal_root": str(self.root),
            "peal_compose_bin": str(self.root / "peal-compose"),
            "peal_compose_profiles": [],
            "peal_release_dir": str(folder),
            "peal_release_tag": commit,
            "peal_release_postgres_tag": "synthetic",
            "peal_release_files": {"changed": True},
        }

    @property
    def env_files(self) -> list[Path]:
        return [self.root / name for name in ("host.env", "credentials.env", "secrets.env")]

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
def test_a_changed_file_host_env_names_recreates_its_service(server: Server) -> None:
    """host.env names the same file in both releases, so the mount's source
    reads the same: only its hash tells Compose the file changed."""
    with (server.root / "host.env").open("a") as host_env:
        host_env.write("PEAL_GRAFANA_CONTACT_POINTS='./config/grafana/alerting/telegram.yaml'\n")
    server.release("aaaaaaaaaaaa", STACK)
    before = server.containers()

    changed = "apiVersion: 1\ncontactPoints: [{name: synthetic-changed}]\n"
    server.release("bbbbbbbbbbbb", {**STACK, "config/grafana/alerting/telegram.yaml": changed})

    assert server.container("grafana") != before["grafana"]
    assert server.container("loki") == before["loki"]
    assert "synthetic-changed" in server.read("grafana", "/etc/grafana/provisioning/alerting/contact-points.yaml")


@docker
def test_noise_on_stderr_leaves_the_hashes_readable(server: Server) -> None:
    """Python's verbose imports, on stderr, stand for a warning there."""
    server.release("aaaaaaaaaaaa", STACK, environment={"PYTHONVERBOSE": "1"})

    release_env = (server.root / "release.env").read_text()

    assert re.search(r"^PEAL_GRAFANA_CONFIG_HASH=[0-9a-f]{16}$", release_env, re.MULTILINE), release_env


@docker
def test_check_mode_says_why_release_env_lists_no_hash(server: Server) -> None:
    """Before the upload, check mode has no release folder to hash."""
    folder = server.root / "releases" / "aaaaaaaaaaaa"

    ran = _play(server.root.parent, [INSTALL, HASH, REPORT, NAME], check=True, **server.settings(folder, "aaaaaaaaaaaa"))

    assert ran.returncode == 0, ran.stdout + ran.stderr
    assert "Check mode has not uploaded the release" in ran.stdout


@docker
def test_the_script_prints_hashes_and_no_setting(server: Server) -> None:
    folder = _release(server.root / "releases" / "aaaaaaaaaaaa", STACK)

    ran = _hash(folder, server.env_files)

    assert ran.returncode == 0, ran.stderr
    assert sorted(json.loads(ran.stdout)) == ["PEAL_GRAFANA_CONFIG_HASH", "PEAL_LOKI_CONFIG_HASH"]
    assert "synthetic-password" not in ran.stdout + ran.stderr


@docker
def test_compose_s_error_text_is_never_printed(server: Server) -> None:
    """Compose quotes a malformed value in its error: the script says what
    failed in words of its own."""
    folder = _release(server.root / "releases" / "aaaaaaaaaaaa", STACK)
    (server.root / "secrets.env").write_text('POSTGRES_PASSWORD="synthetic${leak-me"\n')

    ran = _hash(folder, server.env_files)

    assert ran.returncode != 0
    assert "leak-me" not in ran.stdout + ran.stderr
    assert "docker compose config failed" in ran.stderr


@docker
def test_a_missing_setting_is_named(server: Server) -> None:
    folder = _release(server.root / "releases" / "aaaaaaaaaaaa", STACK)
    (server.root / "secrets.env").write_text("")

    ran = _hash(folder, server.env_files)

    assert ran.returncode != 0
    assert "POSTGRES_PASSWORD" in ran.stderr


@docker
def test_a_relative_release_folder_hashes_the_same(server: Server) -> None:
    folder = _release(server.root / "releases" / "aaaaaaaaaaaa", STACK)

    absolute = _hash(folder, server.env_files)
    relative = _hash(Path("releases") / "aaaaaaaaaaaa", server.env_files, cwd=server.root)

    assert relative.returncode == 0, relative.stderr
    assert json.loads(relative.stdout) == json.loads(absolute.stdout)


@docker
def test_a_stack_with_no_mount_of_the_release_fails(server: Server) -> None:
    """No hash at all would leave every label empty, as before the fix."""
    compose = COMPOSE.split("  loki:", 1)[0]
    folder = _release(server.root / "releases" / "aaaaaaaaaaaa", {"compose.production.yaml": compose})

    ran = _hash(folder, server.env_files)

    assert ran.returncode != 0
    assert ran.stdout == ""
    assert "no service mounts files of the release folder" in ran.stderr


@docker
def test_only_the_profiles_given_are_read(server: Server) -> None:
    """The services the server runs, as peal-compose names its profiles: a
    service of another profile gets no hash."""
    compose = COMPOSE + "  docs:\n    <<: *service\n    profiles: [docs]\n    volumes:\n      - ./config/docs.yaml:/etc/docs.yaml:ro\n"
    folder = _release(server.root / "releases" / "aaaaaaaaaaaa", {**STACK, "compose.production.yaml": compose, "config/docs.yaml": "{}\n"})

    without = _hash(folder, server.env_files)
    with_docs = _hash(folder, server.env_files, "--profile", "docs")

    assert without.returncode == 0, without.stderr
    assert "PEAL_DOCS_CONFIG_HASH" not in json.loads(without.stdout)
    assert "PEAL_DOCS_CONFIG_HASH" in json.loads(with_docs.stdout)


@docker
def test_the_production_stack_hashes_its_telemetry(tmp_path: Path) -> None:
    """compose.production.yaml itself, with synthetic settings and the
    privacy declaration outside the release, as on Peal's servers."""
    release = tmp_path / "release"
    shutil.copytree(DOCKER, release, ignore=shutil.ignore_patterns("node_modules", "test"))
    required = sorted(set(re.findall(r"\$\{([A-Z0-9_]+):\?", (DOCKER / "compose.production.yaml").read_text())))
    env = tmp_path / "synthetic.env"
    env.write_text("".join(f"{name}=synthetic\n" for name in required) + "PEAL_PRIVACY_DECLARATION=/srv/peal/privacy-declaration.json\n")

    ran = _hash(release, [env], "--profile", "static")

    assert ran.returncode == 0, ran.stderr
    assert sorted(json.loads(ran.stdout)) == [
        "PEAL_GRAFANA_CONFIG_HASH",
        "PEAL_LOKI_CONFIG_HASH",
        "PEAL_OTEL_COLLECTOR_CONFIG_HASH",
        "PEAL_PROMETHEUS_CONFIG_HASH",
        "PEAL_TEMPO_CONFIG_HASH",
    ]
