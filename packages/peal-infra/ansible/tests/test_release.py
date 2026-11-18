"""The release's steps on Postgres (roles/peal_release), run as written
against the image postgres.Dockerfile builds on, in a container of their
own: what they read, and how they set the password a restored database
keeps from the server it came from."""

from __future__ import annotations

import secrets
import shutil
import subprocess
import time
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import pytest

from conftest import INFRA, command_of, render, stdin_of, task

DOCKERFILE = INFRA.parent.parent / "peal-docker" / "postgres.Dockerfile"

IMAGE = next(
    line.split()[1] for line in DOCKERFILE.read_text().splitlines() if line.startswith("FROM ")
)


def _docker_runs() -> bool:
    return (
        shutil.which("docker") is not None
        and subprocess.run(["docker", "info"], capture_output=True, check=False).returncode == 0
    )


pytestmark = pytest.mark.skipif(not _docker_runs(), reason="Docker is not running")

# The password secrets.env holds, and the one of the server a backup came from.
GENERATED = f"generated-{secrets.token_hex(8)}"
RESTORED = f"restored-{secrets.token_hex(8)}"

# Stands for peal-compose in the tasks: `<it> exec -T postgres …` runs in the
# test's container.
COMPOSE = "peal-compose"


@dataclass(frozen=True)
class Postgres:
    """The test's Postgres: a container named as Compose names the stack's,
    on a network where `postgres` names it."""

    project: str
    network: str
    container: str


def _run(command: list[str], stdin: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, input=stdin, capture_output=True, text=True, check=False)


def _psql(postgres: Postgres, statement: str) -> None:
    """Runs a statement as the image's superuser, over the trusted socket."""
    _run(["docker", "exec", postgres.container, "psql", "--username", "peal", "--dbname", "peal",
          "--set", "ON_ERROR_STOP=1", "--command", statement]).check_returncode()


@pytest.fixture(scope="module")
def postgres() -> Iterator[Postgres]:
    project = f"peal-infra-test-{secrets.token_hex(4)}"
    stack = Postgres(project, f"{project}_default", f"{project}-postgres-1")
    _run(["docker", "network", "create", stack.network]).check_returncode()
    try:
        _run(["docker", "run", "--detach", "--name", stack.container, "--network", stack.network,
              "--network-alias", "postgres", "--env", "POSTGRES_USER=peal",
              "--env", "POSTGRES_DB=peal", "--env", f"POSTGRES_PASSWORD={GENERATED}",
              IMAGE]).check_returncode()
        # Ready once it answers over the network: while the image initialises
        # the database, its server listens on the socket alone.
        for _ in range(120):
            if _signs_in(stack, GENERATED):
                break
            time.sleep(0.5)
        else:
            pytest.fail("Postgres did not start")
        yield stack
    finally:
        _run(["docker", "rm", "--force", stack.container])
        _run(["docker", "network", "rm", stack.network])


def _signs_in(postgres: Postgres, password: str) -> bool:
    """Whether the server, another container on the network, signs in with
    this password, as DATABASE_URL says."""
    return _run(["docker", "run", "--rm", "--network", postgres.network, IMAGE, "psql",
                 f"postgres://peal:{password}@postgres:5432/peal", "--command", "SELECT 1"]).returncode == 0


def _step(postgres: Postgres, name: str) -> subprocess.CompletedProcess[str]:
    """Runs a release task's command as the release would, in the test's
    stack."""
    found = task("peal_release", name)
    command = command_of(
        found,
        peal_compose_bin=COMPOSE,
        peal_compose_project=postgres.project,
        peal_release_built={"postgres": IMAGE},
    )
    if command[:4] == [COMPOSE, "exec", "-T", "postgres"]:
        command = ["docker", "exec", "--interactive", postgres.container, *command[4:]]
    return _run(command, stdin_of(found))


@pytest.fixture
def restored(postgres: Postgres) -> Iterator[Postgres]:
    """The stack with the password of the server the database came from."""
    _psql(postgres, f"ALTER ROLE peal PASSWORD '{RESTORED}'")
    yield postgres
    _psql(postgres, f"ALTER ROLE peal PASSWORD '{GENERATED}'")


class TestThePassword:
    """The release's steps on the database password, against one
    Postgres, started once for these tests in one of xdist's workers
    (conftest's scheduler runs a class in one)."""

    def test_the_check_refuses_the_restored_password(self, restored: Postgres) -> None:
        assert not _signs_in(restored, GENERATED)

        assert _step(restored, "Check the database password").returncode != 0

    def test_the_check_accepts_the_generated_password(self, postgres: Postgres) -> None:
        assert _step(postgres, "Check the database password").returncode == 0

    def test_setting_the_password_lets_the_server_sign_in(self, restored: Postgres) -> None:
        _step(restored, "Set the database password to the generated one").check_returncode()

        assert _signs_in(restored, GENERATED)
        assert _step(restored, "Check the database password").returncode == 0

    def test_setting_the_password_logs_it_nowhere(self, restored: Postgres) -> None:
        """Not in Postgres's log, even where it logs every statement, nor on a
        command line, where any process on the host could read it."""
        found = task("peal_release", "Set the database password to the generated one")
        _psql(restored, "ALTER SYSTEM SET log_statement = 'all'")
        _psql(restored, "SELECT pg_reload_conf()")
        try:
            _step(restored, "Set the database password to the generated one").check_returncode()
        finally:
            _psql(restored, "ALTER SYSTEM RESET log_statement")
            _psql(restored, "SELECT pg_reload_conf()")
        logs = _run(["docker", "logs", restored.container])

        assert GENERATED not in logs.stdout + logs.stderr
        assert all("POSTGRES_PASSWORD" not in part for part in command_of(found, peal_compose_bin=COMPOSE))

    def test_reading_what_postgres_runs_shows_no_secret(self, postgres: Postgres) -> None:
        """The release compares images and settings, and registers what it reads,
        which Ansible prints with -v: never the container's environment."""
        running = _step(postgres, "Read what Postgres runs")
        to_run = _step(postgres, "Read what Postgres is to run")

        assert running.returncode == 0
        assert GENERATED not in running.stdout + running.stderr
        assert running.stdout.split()[0] == to_run.stdout.strip()


# The blog's database (peal_blog): its role and database on the stack's
# Postgres, with the password secrets.env holds.
BLOG_GENERATED = f"blog-generated-{secrets.token_hex(8)}"
BLOG_RESTORED = f"blog-restored-{secrets.token_hex(8)}"


def _blog_step(postgres: Postgres, root: Path, name: str) -> subprocess.CompletedProcess[str]:
    """Runs a release task's command as the release would: on the host,
    reading secrets.env in root, against the test's container."""
    found = task("peal_release", name)
    command = command_of(found, peal_root=str(root), peal_compose_project=postgres.project)
    return _run(command, stdin_of(found))


def _blog_signs_in(postgres: Postgres, password: str) -> bool:
    """Whether the blog, another container on the network, signs in."""
    return _run(["docker", "run", "--rm", "--network", postgres.network, IMAGE, "psql",
                 f"postgres://peal_blog:{password}@postgres:5432/peal_blog", "--command", "SELECT 1"]).returncode == 0


@pytest.fixture
def blog_root(tmp_path: Path) -> Path:
    """The server's folder, with the blog's password in secrets.env."""
    (tmp_path / "secrets.env").write_text(f"POSTGRES_PASSWORD={GENERATED}\nPEAL_BLOG_DATABASE_PASSWORD={BLOG_GENERATED}\n")
    return tmp_path


class TestTheBlogDatabase:
    """The release's steps on the blog's role and database, against one
    Postgres of their own, run in order: a new blog, a second release, then
    a database restored with another password."""

    def test_the_role_and_database_are_made_once_and_kept_in_step(self, postgres: Postgres, blog_root: Path) -> None:
        check = "Check the blog's database password"
        create = "Create the blog's role and database"

        # A new blog: no role yet, so the check is refused.
        assert _blog_step(postgres, blog_root, check).returncode != 0

        _blog_step(postgres, blog_root, create).check_returncode()

        assert _blog_signs_in(postgres, BLOG_GENERATED)
        assert _blog_step(postgres, blog_root, check).returncode == 0

        # The role owns its database and has no other attribute.
        owner = _run(["docker", "exec", postgres.container, "psql", "--username", "peal", "--dbname", "peal",
                      "--tuples-only", "--no-align", "--command",
                      "SELECT pg_get_userbyid(datdba), r.rolsuper, r.rolcreatedb, r.rolcreaterole "
                      "FROM pg_database d JOIN pg_roles r ON r.rolname = 'peal_blog' "
                      "WHERE datname = 'peal_blog'"])
        assert owner.stdout.strip() == "peal_blog|f|f|f"

        # Running it again (as a second release would, were the check to
        # fail) changes nothing and fails on nothing.
        _blog_step(postgres, blog_root, create).check_returncode()
        assert _blog_signs_in(postgres, BLOG_GENERATED)

        # A database restored from a server with another password.
        _psql(postgres, f"ALTER ROLE peal_blog PASSWORD '{BLOG_RESTORED}'")
        assert _blog_step(postgres, blog_root, check).returncode != 0

        _blog_step(postgres, blog_root, create).check_returncode()

        assert _blog_signs_in(postgres, BLOG_GENERATED)
        assert _blog_step(postgres, blog_root, check).returncode == 0

    def test_the_blog_s_role_reaches_its_own_database_alone(self, postgres: Postgres, blog_root: Path) -> None:
        """Postgres lets every role connect to every database: the app's is
        closed to the blog's role, and still open to the app's."""
        _psql(postgres, f"ALTER ROLE peal PASSWORD '{GENERATED}'")
        _blog_step(postgres, blog_root, "Create the blog's role and database").check_returncode()

        into_app = _run(["docker", "run", "--rm", "--network", postgres.network, IMAGE, "psql",
                         f"postgres://peal_blog:{BLOG_GENERATED}@postgres:5432/peal", "--command", "SELECT 1"])

        assert into_app.returncode != 0
        assert "permission denied" in into_app.stderr
        assert _signs_in(postgres, GENERATED)
        assert _blog_signs_in(postgres, BLOG_GENERATED)

    def test_an_empty_password_is_refused_before_anything_changes(self, postgres: Postgres, tmp_path: Path) -> None:
        """Without the password in secrets.env, neither step reaches Postgres:
        the blog's role keeps the password it had, never an empty one."""
        (tmp_path / "secrets.env").write_text(f"POSTGRES_PASSWORD={GENERATED}\n")
        _run(["docker", "exec", postgres.container, "psql", "--username", "peal", "--dbname", "peal",
              "--command", "CREATE ROLE peal_blog LOGIN"])
        _run(["docker", "exec", postgres.container, "psql", "--username", "peal", "--dbname", "peal",
              "--command", "CREATE DATABASE peal_blog OWNER peal_blog"])
        _psql(postgres, f"ALTER ROLE peal_blog PASSWORD '{BLOG_RESTORED}'")

        for name in ["Check the blog's database password", "Create the blog's role and database"]:
            assert _blog_step(postgres, tmp_path, name).returncode != 0

        assert _blog_signs_in(postgres, BLOG_RESTORED)

    def test_the_password_is_logged_nowhere(self, postgres: Postgres, blog_root: Path) -> None:
        """Not in Postgres's log, even where it logs every statement, nor in
        the command, which any process on the host could read."""
        _psql(postgres, f"ALTER ROLE peal PASSWORD '{GENERATED}'")
        _psql(postgres, "ALTER SYSTEM SET log_statement = 'all'")
        _psql(postgres, "SELECT pg_reload_conf()")
        try:
            ran = _blog_step(postgres, blog_root, "Create the blog's role and database")
            ran.check_returncode()
            checked = _blog_step(postgres, blog_root, "Check the blog's database password")
        finally:
            _psql(postgres, "ALTER SYSTEM RESET log_statement")
            _psql(postgres, "SELECT pg_reload_conf()")
        logs = _run(["docker", "logs", postgres.container])

        assert BLOG_GENERATED not in logs.stdout + logs.stderr
        assert BLOG_GENERATED not in ran.stdout + ran.stderr + checked.stdout + checked.stderr
        for name in ["Create the blog's role and database", "Check the blog's database password"]:
            command = command_of(task("peal_release", name), peal_root=str(blog_root), peal_compose_project="peal")
            assert all(BLOG_GENERATED not in part for part in command)


def test_the_release_stops_early_without_the_blog_s_secrets(tmp_path: Path) -> None:
    """Before it replaces anything, the release names the blog's secrets
    secrets.env lacks."""
    found = task("peal_release", "Find whether secrets.env lacks the blog's secrets")
    script = render(found["ansible.builtin.shell"], peal_root=str(tmp_path))
    secrets_env = tmp_path / "secrets.env"

    secrets_env.write_text("POSTGRES_PASSWORD=synthetic\nPEAL_BLOG_DATABASE_PASSWORD=\n")
    missing = _run(["sh", "-c", script])

    assert missing.stdout.split() == ["PEAL_BLOG_DATABASE_PASSWORD", "PEAL_BLOG_ENCRYPTION_KEY"]

    secrets_env.write_text("PEAL_BLOG_DATABASE_PASSWORD=synthetic\nPEAL_BLOG_ENCRYPTION_KEY=emdash_enc_v1_synthetic\n")

    assert _run(["sh", "-c", script]).stdout == ""
