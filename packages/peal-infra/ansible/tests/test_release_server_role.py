"""The server's own database role (roles/peal_release): the release creates
peal_server, a role with no attribute but LOGIN, gives it Peal's database
and everything the superuser owns in it, and the server signs in as it.
Run as written against the image postgres.Dockerfile builds on, with the
server's own migrations, on a new database and on one the superuser has
run for months."""

from __future__ import annotations

import secrets
import shutil
import subprocess
import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

import pytest

from conftest import INFRA, command_of, stdin_of, task

DOCKERFILE = INFRA.parent.parent / "peal-docker" / "postgres.Dockerfile"
MIGRATIONS = INFRA.parent.parent / "peal-server" / "drizzle"

IMAGE = next(
    line.split()[1] for line in DOCKERFILE.read_text().splitlines() if line.startswith("FROM ")
)


def _docker_runs() -> bool:
    return (
        shutil.which("docker") is not None
        and subprocess.run(["docker", "info"], capture_output=True, check=False).returncode == 0
    )


pytestmark = pytest.mark.skipif(not _docker_runs(), reason="Docker is not running")

SUPERUSER = f"superuser-{secrets.token_hex(8)}"
GENERATED = f"generated-{secrets.token_hex(8)}"
RESTORED = f"restored-{secrets.token_hex(8)}"

CHECK = "Check the server's database password"
CREATE = "Create the server's database role"
GIVE = "Give the server's role its database"

# What Effect's cluster and Drizzle's migrator make when the server starts,
# beside the migrations: a table in public, a schema with a serial id.
STARTUP = """
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint);
CREATE TABLE IF NOT EXISTS public.cluster_messages (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, body text);
"""

# Kinds of object the migrations hold none of yet, which a later one, or a
# runbook run as the superuser, may make.
OTHER_KINDS = """
CREATE TYPE publishing.synthetic_mood AS ENUM ('calm', 'busy');
CREATE DOMAIN publishing.synthetic_positive AS integer CHECK (VALUE > 0);
CREATE TYPE publishing.synthetic_pair AS (left_side text, right_side text);
CREATE SEQUENCE publishing.synthetic_free_sequence;
CREATE VIEW publishing.synthetic_view AS SELECT 1 AS one;
CREATE MATERIALIZED VIEW publishing.synthetic_matview AS SELECT 1 AS one;
CREATE FUNCTION publishing.synthetic_function() RETURNS integer LANGUAGE sql AS 'SELECT 1';
CREATE PROCEDURE publishing.synthetic_procedure() LANGUAGE sql AS 'SELECT 1';
CREATE TABLE publishing.synthetic_partitioned (id integer) PARTITION BY RANGE (id);
CREATE TABLE publishing.synthetic_partition PARTITION OF publishing.synthetic_partitioned FOR VALUES FROM (0) TO (10);
"""

# Whatever is still not the server's in Peal's database: schemas,
# relations, functions and types outside Postgres's own, but an
# extension's.
NOT_THE_SERVER_S = """
SELECT kind || ' ' || name FROM (
  SELECT 'database' AS kind, datname::text AS name, datdba AS owner, 0::oid AS oid, 'pg_database'::regclass AS class
    FROM pg_database WHERE datname = 'peal'
  UNION ALL SELECT 'schema', nspname::text, nspowner, oid, 'pg_namespace'::regclass FROM pg_namespace
    WHERE nspname !~ '^pg_' AND nspname <> 'information_schema' AND nspname <> 'public'
  UNION ALL SELECT 'relation', c.oid::regclass::text, relowner, c.oid, 'pg_class'::regclass FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
  UNION ALL SELECT 'function', p.oid::regprocedure::text, proowner, p.oid, 'pg_proc'::regclass FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
  UNION ALL SELECT 'type', t.oid::regtype::text, typowner, t.oid, 'pg_type'::regclass FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
      AND t.typtype <> 'm'
) objects
WHERE pg_get_userbyid(owner) <> 'peal_server'
  AND NOT EXISTS (SELECT FROM pg_depend d WHERE d.classid = objects.class AND d.objid = objects.oid AND d.deptype = 'e')
ORDER BY 1
"""

# What the server does as its role once it signs in: a later migration,
# the cluster's tables, its locks, reads and writes.
AS_THE_SERVER = """
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('peal-server/migrations'));
CREATE SCHEMA synthetic_later;
CREATE TABLE synthetic_later.things (id serial PRIMARY KEY);
ALTER TABLE publishing.posts ADD COLUMN synthetic_later text;
CREATE INDEX ON publishing.posts (synthetic_later);
ALTER TABLE publishing.posts DROP COLUMN synthetic_later;
CREATE TABLE IF NOT EXISTS public.cluster_runners (id integer);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('synthetic', 0);
SELECT count(*) FROM publishing.posts;
COMMIT;
"""


@dataclass(frozen=True)
class Postgres:
    """A Postgres of the test's: a container named as Compose names the
    stack's, on a network where `postgres` names it."""

    project: str
    network: str
    container: str


def _run(command: list[str], stdin: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, input=stdin, capture_output=True, text=True, check=False)


def _signs_in(postgres: Postgres, user: str, password: str, database: str = "peal") -> bool:
    return _run(["docker", "run", "--rm", "--network", postgres.network, IMAGE, "psql",
                 f"postgres://{user}:{password}@postgres:5432/{database}", "--command", "SELECT 1"]).returncode == 0


@contextmanager
def _postgres() -> Iterator[Postgres]:
    project = f"peal-infra-test-{secrets.token_hex(4)}"
    stack = Postgres(project, f"{project}_database", f"{project}-postgres-1")
    _run(["docker", "network", "create", stack.network]).check_returncode()
    try:
        _run(["docker", "run", "--detach", "--name", stack.container, "--network", stack.network,
              "--network-alias", "postgres", "--env", "POSTGRES_USER=peal",
              "--env", "POSTGRES_DB=peal", "--env", f"POSTGRES_PASSWORD={SUPERUSER}",
              IMAGE]).check_returncode()
        for _ in range(120):
            if _signs_in(stack, "peal", SUPERUSER):
                break
            time.sleep(0.5)
        else:
            pytest.fail("Postgres did not start")
        yield stack
    finally:
        _run(["docker", "rm", "--force", stack.container])
        _run(["docker", "network", "rm", stack.network])


def _as_superuser(postgres: Postgres, sql: str) -> str:
    """Runs SQL as the image's superuser, over the trusted socket."""
    ran = _run(["docker", "exec", "--interactive", postgres.container, "psql", "--username", "peal",
                "--dbname", "peal", "--no-psqlrc", "--quiet", "--tuples-only", "--no-align",
                "--set", "ON_ERROR_STOP=1"], sql)
    assert ran.returncode == 0, ran.stderr
    return ran.stdout


def _as_the_server(postgres: Postgres, sql: str) -> subprocess.CompletedProcess[str]:
    """Runs SQL as the server signs in, over the network."""
    return _run(["docker", "run", "--rm", "--interactive", "--network", postgres.network, IMAGE, "psql",
                 f"postgres://peal_server:{GENERATED}@postgres:5432/peal", "--no-psqlrc", "--quiet",
                 "--set", "ON_ERROR_STOP=1", "--single-transaction"], sql)


def _migrations() -> list[str]:
    """The server's migrations, in the order Drizzle applies them."""
    return [path.read_text() for path in sorted(MIGRATIONS.glob("*/migration.sql"))]


def _step(postgres: Postgres, root: Path, name: str) -> subprocess.CompletedProcess[str]:
    found = task("peal_release", name)
    command = command_of(found, peal_root=str(root), peal_compose_project=postgres.project)
    return _run(command, stdin_of(found))


@pytest.fixture
def root(tmp_path: Path) -> Path:
    """The server's folder, with the role's password in secrets.env."""
    (tmp_path / "secrets.env").write_text(f"POSTGRES_PASSWORD={SUPERUSER}\nPEAL_DATABASE_PASSWORD={GENERATED}\n")
    return tmp_path


def _release(postgres: Postgres, root: Path) -> str:
    """The release's steps on the role, in order, as the release runs them:
    what the last one printed."""
    if _step(postgres, root, CHECK).returncode != 0:
        _step(postgres, root, CREATE).check_returncode()
    given = _step(postgres, root, GIVE)
    assert given.returncode == 0, given.stderr
    return given.stdout.strip()


def test_a_new_database_is_migrated_by_the_server_s_role(root: Path) -> None:
    """On a new database, the role made before the server starts runs every
    migration itself: schemas, pg_trgm (a trusted extension), tables."""
    with _postgres() as postgres:
        assert _step(postgres, root, CHECK).returncode != 0

        assert _release(postgres, root) == "1"  # The database alone.
        assert _signs_in(postgres, "peal_server", GENERATED)

        # In one transaction, as Drizzle's migrator applies them.
        migrated = _as_the_server(postgres, "\n;\n".join([STARTUP, *_migrations()]))
        assert migrated.returncode == 0, migrated.stderr

        assert _as_superuser(postgres, NOT_THE_SERVER_S) == ""
        ran = _as_the_server(postgres, AS_THE_SERVER)
        assert ran.returncode == 0, ran.stderr

        role = _as_superuser(postgres, "SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls "
                                       "FROM pg_roles WHERE rolname = 'peal_server'")
        assert role.strip() == "f|f|f|f|f"


def test_an_existing_database_goes_to_the_server_s_role(root: Path) -> None:
    """A database the superuser migrated and ran: every object it made goes
    to the role, the server then runs as it, a second release changes
    nothing, and what the superuser makes later goes at the next."""
    with _postgres() as postgres:
        for migration in [STARTUP, *_migrations(), OTHER_KINDS]:
            _as_superuser(postgres, migration)
        assert _as_superuser(postgres, NOT_THE_SERVER_S) != ""

        moved = _release(postgres, root)

        assert int(moved) > 100
        assert _as_superuser(postgres, NOT_THE_SERVER_S) == ""
        ran = _as_the_server(postgres, AS_THE_SERVER)
        assert ran.returncode == 0, ran.stderr

        # A second release finds the password right and nothing to move.
        assert _step(postgres, root, CHECK).returncode == 0
        assert _release(postgres, root) == "0"

        # A roll-back to a release that ran as the superuser, or a runbook.
        _as_superuser(postgres, "CREATE TABLE publishing.synthetic_rolled_back (id serial PRIMARY KEY)")
        assert _release(postgres, root) == "1"  # The table, its sequence with it.
        assert _as_superuser(postgres, NOT_THE_SERVER_S) == ""

        # The superuser still signs in, on the socket and over the network.
        assert _signs_in(postgres, "peal", SUPERUSER)


def test_a_restored_role_gets_the_generated_password_back(root: Path) -> None:
    """A database restored from another server keeps that server's
    password for the role: the check is refused, and the release sets it."""
    with _postgres() as postgres:
        _release(postgres, root)
        _as_superuser(postgres, f"ALTER ROLE peal_server PASSWORD '{RESTORED}'")

        assert _step(postgres, root, CHECK).returncode != 0
        assert _release(postgres, root) == "0"
        assert _signs_in(postgres, "peal_server", GENERATED)
        assert not _signs_in(postgres, "peal_server", RESTORED)


def test_the_password_is_logged_nowhere(root: Path) -> None:
    """Not in Postgres's log, where it logs every statement, nor in the
    commands, which any process on the host could read."""
    with _postgres() as postgres:
        _as_superuser(postgres, "ALTER SYSTEM SET log_statement = 'all'")
        _as_superuser(postgres, "SELECT pg_reload_conf()")
        ran = [_step(postgres, root, name) for name in [CHECK, CREATE, CHECK, GIVE]]
        logs = _run(["docker", "logs", postgres.container])

        assert GENERATED not in logs.stdout + logs.stderr
        assert all(GENERATED not in step.stdout + step.stderr for step in ran)
        for name in [CHECK, CREATE, GIVE]:
            command = command_of(task("peal_release", name), peal_root=str(root), peal_compose_project="peal")
            assert all(GENERATED not in part for part in command)


def test_without_the_password_nothing_changes(tmp_path: Path) -> None:
    """Without the password in secrets.env, neither step reaches Postgres:
    no role with an empty password."""
    (tmp_path / "secrets.env").write_text(f"POSTGRES_PASSWORD={SUPERUSER}\n")
    with _postgres() as postgres:
        for name in [CHECK, CREATE]:
            assert _step(postgres, tmp_path, name).returncode != 0
        assert _as_superuser(postgres, "SELECT count(*) FROM pg_roles WHERE rolname = 'peal_server'").strip() == "0"


def test_the_release_stops_early_without_the_password(tmp_path: Path) -> None:
    found = task("peal_release", "Find whether secrets.env lacks the server's database password")
    secrets_env = tmp_path / "secrets.env"

    secrets_env.write_text("POSTGRES_PASSWORD=synthetic\nPEAL_DATABASE_PASSWORD=\n")
    assert _run(command_of(found, peal_root=str(tmp_path))).returncode != 0

    secrets_env.write_text("PEAL_DATABASE_PASSWORD=synthetic\n")
    assert _run(command_of(found, peal_root=str(tmp_path))).returncode == 0
