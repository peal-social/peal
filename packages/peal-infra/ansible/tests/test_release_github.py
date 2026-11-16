"""release.yml publishes a GitHub release of the app once a production
release runs, and only then: named after the day (vYYYY.MM.DD, then .2),
with the notes of the pull requests since the last app tag, by the
generator the docs' Changelog is built with, through the operator's gh.
Released again, a commit changes nothing; check mode publishes nothing; the
sandbox never publishes. gh is a stand-in here, and the repository a
synthetic one, so nothing reaches GitHub."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest
import yaml

from conftest import INFRA, play_tasks, recap_of, settings

CHECK = "Check that gh may publish the app's release"
STOP = "Stop unless gh may publish the app's release"
FETCH = "Fetch the app's release tags"
NAME = "Name the app's release"
READ = "Read the app's release"
NAMED = "Stop unless the app's release has a name"
HISTORY = "Write the release history the docs show"
VIEW = "Read whether GitHub has the app's release"
PUBLISH = "Publish the app's release on GitHub"
REPORT = "Report the app's release check mode leaves out"
TASKS = [CHECK, STOP, FETCH, NAME, READ, NAMED, HISTORY, VIEW, PUBLISH, REPORT]

BUN = shutil.which("bun")
SCRIPT = INFRA.parent.parent / "peal-docs" / "scripts" / "changelog.ts"
DAY = "2026-11-16"

pytestmark = pytest.mark.skipif(BUN is None, reason="Bun is not installed")

# gh as the release needs it: `api` answers whether the account may push,
# `release view` whether GitHub has a release, and `release create` makes
# one, and its tag in the remote, as GitHub does. Each call is logged.
FAKE_GH = """#!{python}
import json, pathlib, subprocess, sys
state = pathlib.Path({state!r})
args = sys.argv[1:]
stdin = sys.stdin.read() if "--notes-file" in args else ""
with (state / "calls.jsonl").open("a") as log:
    log.write(json.dumps({{"args": args, "stdin": stdin}}) + "\\n")
if args[0] == "api":
    print((state / "push").read_text().strip())
elif args[:2] == ["release", "view"]:
    if (state / "fail").exists():
        sys.stderr.write("HTTP 502: Bad Gateway\\n")
        sys.exit(1)
    if not (state / "releases" / args[2]).exists():
        sys.stderr.write("release not found\\n")
        sys.exit(1)
    print(json.dumps({{"tagName": args[2]}}))
elif args[:2] == ["release", "create"]:
    (state / "releases" / args[2]).write_text(stdin)
    target = args[args.index("--target") + 1]
    tags = subprocess.run(["git", "--git-dir", {remote!r}, "tag", "--list", args[2]], capture_output=True, text=True, check=True)
    if not tags.stdout.strip():
        subprocess.run(["git", "--git-dir", {remote!r}, "tag", args[2], target], check=True)
else:
    sys.exit(2)
"""


def _git(folder: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-c", "user.name=Synthetic", "-c", "user.email=synthetic@example.test", "-c", "commit.gpgsign=false", *args],
        cwd=folder,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


class Release:
    """A synthetic repository on a remote, its checkout, and a gh that
    stands in for GitHub."""

    def __init__(self, tmp_path: Path) -> None:
        self.tmp_path = tmp_path
        self.remote = tmp_path / "remote.git"
        self.local = tmp_path / "release"
        self.checkout = self.local / "checkout"
        self.state = tmp_path / "gh"
        (self.state / "releases").mkdir(parents=True)
        (self.state / "push").write_text("true\n")
        _git(tmp_path, "init", "--quiet", "--bare", "--initial-branch=main", str(self.remote))
        self.checkout.mkdir(parents=True)
        _git(self.checkout, "init", "--quiet", "--initial-branch=main")
        _git(self.checkout, "remote", "add", "origin", str(self.remote))
        (self.checkout / "packages" / "peal-docs").mkdir(parents=True)
        self.gh = tmp_path / "fake-gh"
        self.gh.write_text(FAKE_GH.format(python=sys.executable, state=str(self.state), remote=str(self.remote)))
        self.gh.chmod(0o755)

    def commit(self, *subjects: str) -> str:
        for subject in subjects:
            _git(self.checkout, "commit", "--quiet", "--allow-empty", "--message", subject)
        _git(self.checkout, "push", "--quiet", "origin", "main")
        return _git(self.checkout, "rev-parse", "HEAD")

    def run(self, commit: str, *, github: bool = True, check: bool = False, day: str = DAY) -> subprocess.CompletedProcess[str]:
        return play_tasks(
            self.tmp_path,
            "peal_release",
            TASKS,
            check=check,
            peal_release_github=github,
            peal_release_github_repo="peal-social/peal",
            peal_release_repo_url=str(self.remote),
            peal_release_local_dir=str(self.local),
            peal_release_checkout={"after": commit, "before": commit},
            peal_release_changelog_script=str(SCRIPT),
            peal_release_bun=BUN,
            peal_release_gh=str(self.gh),
            peal_release_date=day,
        )

    def calls(self) -> list[dict[str, Any]]:
        log = self.state / "calls.jsonl"
        return [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []

    def created(self) -> list[dict[str, Any]]:
        return [call for call in self.calls() if call["args"][:2] == ["release", "create"]]

    def history(self) -> dict[str, Any]:
        return json.loads((self.checkout / "packages" / "peal-docs" / "changelog.json").read_text())


@pytest.fixture
def release(tmp_path: Path) -> Release:
    return Release(tmp_path)


def _ok(ran: subprocess.CompletedProcess[str]) -> dict[str, int]:
    assert ran.returncode == 0, ran.stdout + ran.stderr
    return recap_of(ran)


def test_the_first_release_publishes_the_whole_history(release: Release) -> None:
    commit = release.commit(
        "chore: set up the workspace",
        "feat(sdk): generate the clients (#1)",
        "test: a test (#2)",
        "fix(web): keep the time zone (#3)",
    )

    recap = _ok(release.run(commit))

    [created] = release.created()
    assert created["args"] == [
        "release", "create", "v2026.11.16", "--repo", "peal-social/peal", "--target", commit,
        "--title", "v2026.11.16", "--notes-file", "-", "--latest",
    ]
    assert created["stdin"] == (
        "## Features\n\n- Generate the clients ([#1](https://github.com/peal-social/peal/pull/1))\n\n"
        "## Fixes\n\n- Keep the time zone ([#3](https://github.com/peal-social/peal/pull/3))\n\n"
    )
    assert recap["changed"] == 1
    assert [found["tag"] for found in release.history()["releases"]] == ["v2026.11.16"]


def test_releasing_the_same_commit_again_changes_nothing(release: Release) -> None:
    commit = release.commit("feat: a feature (#1)")
    _ok(release.run(commit))

    recap = _ok(release.run(commit, day="2026-11-17"))

    assert len(release.created()) == 1
    assert recap["changed"] == 0
    assert [found["tag"] for found in release.history()["releases"]] == ["v2026.11.16"]


def test_a_tag_without_its_release_gets_the_release(release: Release) -> None:
    commit = release.commit("feat: a feature (#1)")
    _git(release.tmp_path, "--git-dir", str(release.remote), "tag", "v2026.11.15", commit)

    _ok(release.run(commit))

    [created] = release.created()
    assert created["args"][2] == "v2026.11.15"


def test_a_second_release_that_day_takes_the_next_name_and_the_new_pull_requests(release: Release) -> None:
    _ok(release.run(release.commit("feat: a feature (#1)")))
    commit = release.commit("perf: fewer queries (#2)", "fix(security): check the origin (#3)")

    _ok(release.run(commit))

    second = release.created()[1]
    assert second["args"][2] == "v2026.11.16.2"
    assert second["stdin"] == (
        "## Performance\n\n- Fewer queries ([#2](https://github.com/peal-social/peal/pull/2))\n\n"
        "## Security\n\n- Check the origin ([#3](https://github.com/peal-social/peal/pull/3))\n\n"
    )
    assert [found["tag"] for found in release.history()["releases"]] == ["v2026.11.16.2", "v2026.11.16"]


def test_check_mode_publishes_and_writes_nothing(release: Release) -> None:
    commit = release.commit("feat: a feature (#1)")

    ran = release.run(commit, check=True)

    _ok(ran)
    assert release.created() == []
    assert "The release publishes v2026.11.16 on GitHub" in ran.stdout
    assert not (release.checkout / "packages" / "peal-docs" / "changelog.json").exists()


def test_check_mode_reports_a_commit_it_has_not_fetched(release: Release) -> None:
    release.commit("feat: a feature (#1)")

    ran = release.run("0" * 40, check=True)

    _ok(ran)
    assert release.created() == []
    assert "Check mode has not fetched" in ran.stdout


def test_the_sandbox_never_calls_gh_and_shows_the_tagged_history(release: Release) -> None:
    first = release.commit("feat: a feature (#1)")
    _git(release.tmp_path, "--git-dir", str(release.remote), "tag", "v2026.11.16", first)
    _git(release.checkout, "fetch", "--quiet", "--tags", "origin")
    commit = release.commit("fix: a fix (#2)")

    recap = _ok(release.run(commit, github=False))

    assert release.calls() == []
    assert recap["changed"] == 0
    assert [found["tag"] for found in release.history()["releases"]] == ["v2026.11.16"]


def test_gh_without_the_right_to_push_stops_before_anything(release: Release) -> None:
    commit = release.commit("feat: a feature (#1)")
    (release.state / "push").write_text("false\n")

    ran = release.run(commit)

    assert ran.returncode != 0
    assert "gh cannot publish a release on peal-social/peal" in ran.stdout
    assert release.created() == []
    assert not (release.checkout / "packages" / "peal-docs" / "changelog.json").exists()


def test_github_answering_an_error_stops_the_release(release: Release) -> None:
    commit = release.commit("feat: a feature (#1)")
    (release.state / "fail").write_text("")

    ran = release.run(commit)

    assert ran.returncode != 0
    assert release.created() == []


def test_production_alone_publishes() -> None:
    assert settings("production")["peal_release_github"] is True
    assert "peal_release_github" not in settings("sandbox")
    defaults = yaml.safe_load((INFRA / "roles" / "peal_release" / "defaults" / "main.yml").read_text())
    assert defaults["peal_release_github"] is False


def test_the_release_is_named_before_the_build_and_published_once_it_runs() -> None:
    names = [found["name"] for found in yaml.safe_load((INFRA / "roles" / "peal_release" / "tasks" / "main.yml").read_text())]

    assert names.index(CHECK) < names.index(NAME) < names.index("Build and upload the images")
    assert names.index(HISTORY) < names.index("Build and upload the images")
    assert names.index(CHECK) < names.index("Create the release folder")
    assert names.index("Check the app through the tunnel") < names.index(VIEW) < names.index(PUBLISH)
    assert names.index(PUBLISH) < names.index("List the releases")


def test_the_default_script_is_the_docs_generator() -> None:
    """The default path, from the playbooks' folder, names the generator."""
    playbooks = INFRA / "playbooks"
    assert (playbooks.parent.parent.parent / "peal-docs" / "scripts" / "changelog.ts") == SCRIPT
    assert SCRIPT.exists()
