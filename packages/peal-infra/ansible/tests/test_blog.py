"""Peal's blog (peal_blog): what the tunnel routes to it, what host.env
gives it, the secrets peal_runtime adds for it and what each environment
requires of it, with the flag on, and nothing of it with the flag off."""

from __future__ import annotations

import re
import shutil
import stat
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
import yaml

from conftest import ansible_render, render, role_file, settings, task
from test_cloudflared import _canonical, _match, _rules, _spellings

ENVIRONMENTS = ["peal-production", "peal-sandbox"]

# The audience tags of both environments, and a synthetic one for the
# blog's Access application: extra vars replace the whole mapping, and the
# routes read only their own.
AUDIENCES = {
    **settings("production")["cloudflare_access_aud"],
    **settings("sandbox")["cloudflare_access_aud"],
    "blog": "synthetic-blog-audience",
}

BLOG = {
    "peal_blog": True,
    "peal_blog_bucket": "peal-synthetic-blog",
    "cloudflare_access_aud": AUDIENCES,
}


@pytest.fixture(scope="module")
def rendered_off(rendered_with: Callable[..., Path]) -> Path:
    return rendered_with(peal_blog=False)


@pytest.fixture(scope="module")
def rendered_blog(rendered_with: Callable[..., Path]) -> Path:
    return rendered_with(**BLOG)


def _site(environment: str) -> str:
    return settings(environment.removeprefix("peal-"))["peal_hostnames"]["site"]


def _service(rules: list[dict[str, Any]], host: str, path: str) -> dict[str, Any]:
    return rules[_match(rules, host, path)]


BLOG_PORT = 4324

PAGES = ["/blog", "/blog/", "/blog/a-post", "/blog/fr/", "/blog/fr/un-article", "/blog/_astro/x.js"]

ADMIN = ["/_emdash", "/_emdash/admin", "/_emdash/admin/setup", "/_emdash/api/setup/admin",
         "/_emdash/api/content/posts"]

MEDIA = ["/_emdash/api/media/file/01SYNTHETIC.png"]

# Under the base, EmDash would take an API call for a public page.
REFUSED = ["/blog/_emdash", "/blog/_emdash/admin", "/blog/_emdash/api/health", "/BLOG/_EMDASH/api/health",
           "/blog/%5Femdash/api/health", "/blog//_emdash/admin", "/blog/./_emdash/admin"]

# What EmDash also answers, which stays the site's.
SITE = ["/", "/pricing", "/robots.txt", "/sitemap.xml", "/.well-known/security.txt", "/blogger"]


def _to_blog(rule: dict[str, Any]) -> bool:
    return rule["service"] == f"http://127.0.0.1:{BLOG_PORT}"


def _audience(rule: dict[str, Any]) -> list[str]:
    access = rule.get("originRequest", {}).get("access", {})
    return access.get("audTag", []) if access.get("required") else []


@pytest.mark.parametrize("environment", ENVIRONMENTS)
def test_without_the_flag_nothing_reaches_a_blog(rendered_off: Path, environment: str) -> None:
    text = (rendered_off / environment / "cloudflared.yml").read_text()
    host_env = (rendered_off / environment / "host.env").read_text()

    assert "_emdash" not in text
    assert str(BLOG_PORT) not in text
    assert "PEAL_BLOG_" not in host_env
    assert "EMAIL_SMTP_" not in host_env


@pytest.mark.parametrize("environment", ENVIRONMENTS)
def test_the_blog_s_routes_come_first_in_their_order(rendered_blog: Path, environment: str) -> None:
    rules = _rules(rendered_blog, environment)
    site = _site(environment)
    on_site = [rule for rule in rules if rule.get("hostname") == site]

    assert [rule.get("path") for rule in on_site] == [
        "(?i)^/+blog/+_emdash",
        "^/+_emdash/+api/+media/+file/",
        "(?i)^/+_emdash(/|$)",
        "^/+blog(/|$)",
        None,
    ]
    assert on_site[0]["service"] == "http_status:404"


@pytest.mark.parametrize("environment", ENVIRONMENTS)
@pytest.mark.parametrize("path", PAGES + MEDIA + ADMIN)
def test_the_blog_gets_its_pages_and_emdash(rendered_blog: Path, environment: str, path: str) -> None:
    assert _to_blog(_service(_rules(rendered_blog, environment), _site(environment), path))


@pytest.mark.parametrize("environment", ENVIRONMENTS)
@pytest.mark.parametrize("path", REFUSED)
def test_emdash_under_the_base_is_refused(rendered_blog: Path, environment: str, path: str) -> None:
    rule = _service(_rules(rendered_blog, environment), _site(environment), path)

    assert rule["service"] == "http_status:404"


@pytest.mark.parametrize("environment", ENVIRONMENTS)
@pytest.mark.parametrize("path", SITE)
def test_the_rest_of_the_host_stays_the_site_s(rendered_blog: Path, environment: str, path: str) -> None:
    rule = _service(_rules(rendered_blog, environment), _site(environment), path)

    assert not _to_blog(rule)
    assert rule["service"] != "http_status:404"


@pytest.mark.parametrize("path", [s for p in ADMIN for s in _spellings(p)]
                         + ["/_emdash/api/media/file/../../admin", "/blog/x/../../_emdash/admin"])
def test_production_s_admin_needs_the_blog_s_access(rendered_blog: Path, path: str) -> None:
    rule = _service(_rules(rendered_blog, "peal-production"), _site("peal-production"), path)

    assert "synthetic-blog-audience" in _audience(rule) or rule["service"].startswith("http_status:"), (
        path, _canonical(path), rule)


@pytest.mark.parametrize("path", PAGES + MEDIA)
def test_production_s_pages_and_media_are_public(rendered_blog: Path, path: str) -> None:
    rule = _service(_rules(rendered_blog, "peal-production"), _site("peal-production"), path)

    assert _audience(rule) == []


@pytest.mark.parametrize("path", PAGES + MEDIA + ADMIN)
def test_the_sandbox_s_blog_stays_behind_access(rendered_blog: Path, path: str) -> None:
    rule = _service(_rules(rendered_blog, "peal-sandbox"), _site("peal-sandbox"), path)

    assert _audience(rule) == [AUDIENCES["sandbox"]]


CLOUDFLARED = shutil.which("cloudflared")


@pytest.mark.skipif(CLOUDFLARED is None, reason="cloudflared is not installed")
@pytest.mark.parametrize("environment", ENVIRONMENTS)
def test_matching_agrees_with_cloudflared(rendered_blog: Path, environment: str) -> None:
    rules = _rules(rendered_blog, environment)
    config = rendered_blog / environment / "cloudflared.yml"
    site = _site(environment)

    for path in [*PAGES, *MEDIA, *ADMIN, *REFUSED, *SITE, "/_EMDASH/admin", "/blog/x/../../_emdash/admin"]:
        answer = subprocess.run(
            [CLOUDFLARED, "tunnel", "--config", str(config), "ingress", "rule", f"https://{site}{path}"],
            check=True, capture_output=True, text=True,
        ).stdout
        matched = re.search(r"Matched rule #(\d+)", answer)

        assert matched is not None, answer
        assert int(matched.group(1)) == _match(rules, site, path), path


def _host_env(rendered: Path, environment: str) -> dict[str, str]:
    lines = (rendered / environment / "host.env").read_text().splitlines()
    return {name: value.strip("'") for name, value in
            (line.split("=", 1) for line in lines if line and not line.startswith("#"))}


@pytest.mark.parametrize("environment", ENVIRONMENTS)
def test_host_env_gives_the_blog_its_settings(rendered_blog: Path, environment: str) -> None:
    host_env = _host_env(rendered_blog, environment)
    group = settings(environment.removeprefix("peal-"))

    assert host_env["PEAL_BLOG_PORT"] == str(BLOG_PORT)
    assert host_env["PEAL_BLOG_SITE_URL"] == f"https://{group['peal_hostnames']['site']}"
    # On the media's endpoint, so the EU check covers it.
    assert host_env["PEAL_BLOG_S3_ENDPOINT"] == group["peal_media_endpoint"]
    assert host_env["PEAL_BLOG_S3_BUCKET"] == "peal-synthetic-blog"
    assert host_env["BLOG_APP_URL"] == group["peal_static_build_args"]["SITE_APP_URL"]
    assert host_env["BLOG_DOCS_URL"] == group["peal_static_build_args"]["SITE_DOCS_URL"]


@pytest.mark.parametrize("environment", ENVIRONMENTS)
def test_the_blog_mails_through_resend_s_relay(rendered_blog: Path, environment: str) -> None:
    host_env = _host_env(rendered_blog, environment)

    # Compose hands the blog RESEND_API_KEY as its SMTP password with it alone.
    assert host_env["PEAL_BLOG_MAIL"] == "true"

    assert {name: host_env[name] for name in host_env if name.startswith("EMAIL_SMTP_")} == {
        "EMAIL_SMTP_HOST": "smtp.resend.com",
        "EMAIL_SMTP_PORT": "465",
        "EMAIL_SMTP_SECURE": "tls",
        "EMAIL_SMTP_USER": "resend",
        "EMAIL_SMTP_FROM": settings(environment.removeprefix("peal-"))["peal_mail_from"],
    }


@pytest.fixture(scope="module")
def rendered_blog_without_mail(rendered_with: Callable[..., Path]) -> Path:
    return rendered_with(**BLOG, peal_blog_mail=False)


@pytest.mark.parametrize("environment", ENVIRONMENTS)
def test_a_blog_without_mail_gets_no_smtp(rendered_blog_without_mail: Path, environment: str) -> None:
    host_env = _host_env(rendered_blog_without_mail, environment)

    assert "PEAL_BLOG_MAIL" not in host_env
    assert not [name for name in host_env if name.startswith("EMAIL_SMTP_")]


def test_compose_hands_the_smtp_password_only_where_the_blog_mails() -> None:
    compose = yaml.safe_load((Path(__file__).parent.parent.parent.parent / "peal-docker"
                              / "compose.production.yaml").read_text())

    assert compose["services"]["blog"]["environment"]["EMAIL_SMTP_PASS"] == "${PEAL_BLOG_MAIL:+${RESEND_API_KEY:-}}"


def _required(environment: str, **names: Any) -> list[str]:
    expression = role_file("peal_runtime", "vars")["peal_runtime_required_credentials"]
    return ansible_render(expression, **{**settings(environment), **names})


@pytest.mark.parametrize("environment", ["production", "sandbox"])
def test_the_blog_requires_its_bucket_key_and_resend(environment: str) -> None:
    on = _required(environment, peal_blog=True)

    assert {"PEAL_BLOG_S3_ACCESS_KEY_ID", "PEAL_BLOG_S3_SECRET_ACCESS_KEY", "RESEND_API_KEY"} <= set(on)
    assert "RESEND_API_KEY" not in _required(environment, peal_blog=True, peal_blog_mail=False)
    assert not {"PEAL_BLOG_S3_ACCESS_KEY_ID", "RESEND_API_KEY"} & set(_required(environment, peal_blog=False))


def test_the_profile_follows_the_flag() -> None:
    expression = yaml.safe_load((Path(__file__).parent.parent / "inventory/group_vars/all/main.yml").read_text())[
        "peal_compose_profiles"]
    names = {**settings("production"), "peal_blog": False}

    assert "blog" not in ansible_render(expression, **names)
    assert "blog" in ansible_render(expression, **{**names, "peal_blog": True})


def _preflight(**names: Any) -> list[str]:
    found = task("peal_preflight", "Refuse a blog without its bucket or its Access application")
    return ansible_render(found["vars"]["peal_preflight_blog_missing"], **names)


def test_the_preflight_refuses_a_blog_without_its_bucket_or_access() -> None:
    production = settings("production")
    sandbox = settings("sandbox")
    audiences = {name: tag for name, tag in production["cloudflare_access_aud"].items() if name != "blog"}
    without = {**production, "peal_blog_bucket": "", "cloudflare_access_aud": audiences}

    assert _preflight(**production) == []
    assert _preflight(**{**without, "peal_blog": False}) == []
    assert _preflight(**without) == ["peal_blog_bucket", "cloudflare_access_aud.blog"]
    assert _preflight(**{**production, **BLOG}) == []
    # The sandbox is behind Access throughout: its own application covers it.
    assert _preflight(**{**sandbox, "peal_blog": True, "peal_blog_bucket": "x"}) == []


# The secrets peal_runtime adds to secrets.env for the blog.

def _generate_blog(root: Path) -> subprocess.CompletedProcess[str]:
    found = task("peal_runtime", "Generate the blog's secrets")
    script = render(found["ansible.builtin.shell"], peal_root=str(root))
    return subprocess.run(["bash", "-c", script], check=True, capture_output=True, text=True)


def _secrets(root: Path) -> dict[str, str]:
    return dict(line.split("=", 1) for line in (root / "secrets.env").read_text().splitlines())


def test_the_blog_s_secrets_are_added_to_an_existing_file_once(tmp_path: Path) -> None:
    found = task("peal_runtime", "Generate the secrets")
    subprocess.run(["sh", "-c", render(found["ansible.builtin.shell"], peal_root=str(tmp_path))], check=True)
    before = _secrets(tmp_path)

    first = _generate_blog(tmp_path)
    after = _secrets(tmp_path)

    assert first.stdout.strip() == "added"
    assert {name: after[name] for name in before} == before
    assert sorted(set(after) - set(before)) == ["PEAL_BLOG_DATABASE_PASSWORD", "PEAL_BLOG_ENCRYPTION_KEY"]
    assert stat.S_IMODE((tmp_path / "secrets.env").stat().st_mode) == 0o600

    second = _generate_blog(tmp_path)

    assert second.stdout.strip() == ""
    assert _secrets(tmp_path) == after


def test_a_missing_blog_secret_alone_is_added(tmp_path: Path) -> None:
    (tmp_path / "secrets.env").write_text("PEAL_BLOG_DATABASE_PASSWORD=kept-synthetic\n")
    (tmp_path / "secrets.env").chmod(0o600)

    assert _generate_blog(tmp_path).stdout.strip() == "added"
    assert _secrets(tmp_path)["PEAL_BLOG_DATABASE_PASSWORD"] == "kept-synthetic"


def test_the_blog_s_secrets_are_ones_emdash_and_postgres_read(tmp_path: Path) -> None:
    (tmp_path / "secrets.env").write_text("")
    _generate_blog(tmp_path)
    secrets = _secrets(tmp_path)

    # src/config/secrets.ts: emdash_enc_v1_ and 32 bytes in base64url.
    assert re.fullmatch(r"emdash_enc_v1_[A-Za-z0-9_-]{43}", secrets["PEAL_BLOG_ENCRYPTION_KEY"])
    assert re.fullmatch(r"[0-9a-f]{64}", secrets["PEAL_BLOG_DATABASE_PASSWORD"])


def test_the_blog_s_secrets_wait_for_the_flag() -> None:
    assert task("peal_runtime", "Generate the blog's secrets")["when"] == "peal_blog | bool"
