"""The measurement of the marketing site, the docs and the blog
(peal_site_measurement): the tunnel sends /pulse/site/ on the site's and the
docs' host names to the web app's relay and nothing else of them, host.env
turns the relay's site mode and the blog's measurement on, the release
builds the site and the docs with PostHog's token from the vault, and the
preflight refuses the switch without that token. Production has it on, the
sandbox off."""

from __future__ import annotations

import re
import shutil
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from ansible.template import trust_as_template

from conftest import INFRA, ansible_render, role_file, settings, task
from test_cloudflared import _audience, _match, _rules, _spellings

# Where the surfaces send, on their own origin, and the tunnel's rule for it.
HOST = "/pulse/site"
PULSE = "^/+pulse/+site/"

TOKEN = "phc_synthetic"
WITH_TOKEN = {"peal_credentials": {"PEAL_POSTHOG_KEY": TOKEN}}

SURFACES = ["site", "docs"]

SENT = ["/pulse/site/e/", "/pulse/site/e/?ip=0&ver=1", "/pulse/site/i/v0/e/"]

# What stays the site's or the docs', however close to the relay's path.
NOT_SENT = [
    "/",
    "/pricing",
    "/pulse",
    "/pulse/",
    "/pulse/site",
    "/pulse/e/",
    "/pulse/app/e/",
    "/pulse/sites/e/",
    "/pulsex/site/e/",
    "/x/pulse/site/e/",
    "/blog/pulse/site/e/",
    "/api/health",
    "/_next/static/x.js",
    "/pulse/site/../../api/health",
]


def _group(environment: str) -> dict[str, Any]:
    return settings(environment.removeprefix("peal-"))


def _web(environment: str) -> str:
    return f"http://127.0.0.1:{_group(environment)['peal_ports']['web']}"


def _host(environment: str, surface: str) -> str:
    return _group(environment)["peal_hostnames"][surface]


def _host_env(rendered: Path, environment: str) -> dict[str, str]:
    lines = (rendered / environment / "host.env").read_text().splitlines()
    return {name: value.strip("'") for name, value in
            (line.split("=", 1) for line in lines if line and not line.startswith("#"))}


@pytest.fixture(scope="module")
def rendered_on(rendered_with: Callable[..., Path]) -> Path:
    """The inventory as it is, with PostHog's token in the vault."""
    return rendered_with(**WITH_TOKEN)


@pytest.fixture(scope="module")
def rendered_switch_off(rendered_with: Callable[..., Path]) -> Path:
    return rendered_with(peal_site_measurement=False, **WITH_TOKEN)


# The inventory.

def test_production_measures_its_site_and_the_sandbox_does_not() -> None:
    """The sandbox's host names are under peal.social too, and would share
    the answer's cookie with production's: it stays off there."""
    assert settings("production")["peal_site_measurement"] is True
    assert settings("sandbox")["peal_site_measurement"] is False


@pytest.mark.parametrize("group", ["all", "production", "sandbox"])
def test_the_token_is_never_in_git(group: str) -> None:
    """The token comes from the vault: no committed file of the inventory
    holds one, or sets what the switch derives from it."""
    for path in (INFRA / "inventory" / "group_vars" / group).glob("*.yml"):
        assert "phc_" not in path.read_text(), path
    found = settings(group) if group != "all" else {}
    derived = re.compile(r"^(SITE|DOCS|BLOG)_POSTHOG_|^DOCS_PRIVACY_URL$|^PEAL_POSTHOG_SITE")
    assert not [name for name in found.get("peal_static_build_args") or {} if derived.match(name)]
    assert not [name for name in found.get("peal_settings") or {} if derived.match(name)]


# The tunnel.

@pytest.mark.parametrize("surface", SURFACES)
@pytest.mark.parametrize("path", [s for p in SENT for s in _spellings(p)[:3]])
def test_production_sends_the_measurement_to_the_web_app(rendered_on: Path, surface: str, path: str) -> None:
    rules = _rules(rendered_on, "peal-production")
    rule = rules[_match(rules, _host("peal-production", surface), path)]

    assert rule["service"] == _web("peal-production"), (path, rule)
    assert rule["path"] == PULSE
    assert _audience(rule) == []


@pytest.mark.parametrize("surface", SURFACES)
def test_the_measurement_rule_comes_before_its_host_s_others(rendered_on: Path, surface: str) -> None:
    host = _host("peal-production", surface)
    on_host = [rule for rule in _rules(rendered_on, "peal-production") if rule.get("hostname") == host]

    assert on_host[0] == {"hostname": host, "path": PULSE, "service": _web("peal-production")}
    assert len(on_host) > 1
    assert "path" not in on_host[-1]


@pytest.mark.parametrize("surface", SURFACES)
@pytest.mark.parametrize("path", NOT_SENT)
def test_nothing_else_of_the_site_or_the_docs_reaches_the_web_app(rendered_on: Path, surface: str, path: str) -> None:
    rules = _rules(rendered_on, "peal-production")
    rule = rules[_match(rules, _host("peal-production", surface), path)]

    assert rule["service"] != _web("peal-production"), (path, rule)


@pytest.mark.parametrize("surface", SURFACES)
def test_the_web_app_gets_only_the_measurement_of_the_site_and_the_docs(rendered_on: Path, surface: str) -> None:
    host = _host("peal-production", surface)
    to_web = [rule for rule in _rules(rendered_on, "peal-production")
              if rule.get("hostname") == host and rule["service"] == _web("peal-production")]

    assert [rule["path"] for rule in to_web] == [PULSE]


@pytest.mark.parametrize("surface", SURFACES)
def test_the_sandbox_sends_none_of_its_site_to_the_web_app(rendered_on: Path, surface: str) -> None:
    host = _host("peal-sandbox", surface)
    rules = _rules(rendered_on, "peal-sandbox")

    assert not [rule for rule in rules if rule.get("hostname") == host and rule["service"] == _web("peal-sandbox")]
    assert "pulse" not in (rendered_on / "peal-sandbox" / "cloudflared.yml").read_text()


def test_without_the_switch_production_routes_no_measurement(rendered_switch_off: Path) -> None:
    assert "pulse" not in (rendered_switch_off / "peal-production" / "cloudflared.yml").read_text()


CLOUDFLARED = shutil.which("cloudflared")


@pytest.mark.skipif(CLOUDFLARED is None, reason="cloudflared is not installed")
def test_matching_agrees_with_cloudflared(rendered_on: Path) -> None:
    rules = _rules(rendered_on, "peal-production")
    config = rendered_on / "peal-production" / "cloudflared.yml"

    for surface in SURFACES:
        host = _host("peal-production", surface)
        for path in [*SENT, "//pulse//site/e/", *NOT_SENT]:
            answer = subprocess.run(
                [CLOUDFLARED, "tunnel", "--config", str(config), "ingress", "rule", f"https://{host}{path}"],
                check=True, capture_output=True, text=True,
            ).stdout
            matched = re.search(r"Matched rule #(\d+)", answer)

            assert matched is not None, answer
            assert int(matched.group(1)) == _match(rules, host, path), (host, path)


# host.env: the relay's site mode, the server's cookie, and the blog's own.

def test_production_turns_the_relay_s_site_mode_on(rendered_on: Path) -> None:
    host_env = _host_env(rendered_on, "peal-production")

    assert host_env["PEAL_POSTHOG_SITE"] == "on"
    assert host_env["PEAL_POSTHOG_SITE_COOKIE_DOMAIN"] == _host("peal-production", "site")
    # The header the relay reads the visitor's address from, as the server.
    assert host_env["AUTH_IP_HEADERS"] == "cf-connecting-ip"


def test_production_s_blog_measures_as_the_site_does(rendered_on: Path) -> None:
    host_env = _host_env(rendered_on, "peal-production")

    assert {name: value for name, value in host_env.items() if name.startswith("BLOG_POSTHOG_")} == {
        "BLOG_POSTHOG_KEY": TOKEN,
        "BLOG_POSTHOG_HOST": HOST,
        "BLOG_POSTHOG_COOKIE_DOMAIN": _host("peal-production", "site"),
        "BLOG_POSTHOG_ENVIRONMENT": "production",
    }


def test_a_server_without_the_blog_gives_no_blog_measurement(rendered_with: Callable[..., Path]) -> None:
    host_env = _host_env(rendered_with(peal_blog=False, **WITH_TOKEN), "peal-production")

    assert host_env["PEAL_POSTHOG_SITE"] == "on"
    assert not [name for name in host_env if name.startswith("BLOG_POSTHOG_")]


def test_the_sandbox_measures_none_of_its_site(rendered_on: Path) -> None:
    host_env = _host_env(rendered_on, "peal-sandbox")

    assert not [name for name in host_env if name.startswith(("PEAL_POSTHOG_SITE", "BLOG_POSTHOG_"))]


def test_without_the_switch_host_env_measures_no_site(rendered_switch_off: Path) -> None:
    host_env = _host_env(rendered_switch_off, "peal-production")

    assert not [name for name in host_env if name.startswith(("PEAL_POSTHOG_SITE", "BLOG_POSTHOG_"))]
    assert host_env["PEAL_POSTHOG_WEB"] == "on"


# The release's build arguments.

def _build_args(environment: str, **names: Any) -> dict[str, str]:
    expression = role_file("peal_release", "defaults")["peal_release_build_args"]
    found = {**settings(environment), **names}
    # The token as group_vars/all reads it from the vault.
    found["peal_site_measurement_token"] = trust_as_template(found["peal_site_measurement_token"])
    return ansible_render(expression, **found)


MEASUREMENT_ARGS = {
    "SITE_POSTHOG_KEY": TOKEN,
    "SITE_POSTHOG_HOST": HOST,
    "SITE_POSTHOG_COOKIE_DOMAIN": "peal.social",
    "SITE_POSTHOG_ENVIRONMENT": "production",
    "DOCS_POSTHOG_KEY": TOKEN,
    "DOCS_POSTHOG_HOST": HOST,
    "DOCS_POSTHOG_COOKIE_DOMAIN": "peal.social",
    "DOCS_POSTHOG_ENVIRONMENT": "production",
    "DOCS_PRIVACY_URL": "https://peal.social/privacy",
}


def test_production_builds_the_site_and_the_docs_with_the_vault_s_token() -> None:
    args = _build_args("production", **WITH_TOKEN)

    assert {name: args[name] for name in MEASUREMENT_ARGS} == MEASUREMENT_ARGS
    # The rest of the environment's arguments, as the inventory gives them.
    assert {name: args[name] for name in settings("production")["peal_static_build_args"]} == settings(
        "production")["peal_static_build_args"]


@pytest.mark.parametrize(("environment", "names"), [
    ("sandbox", WITH_TOKEN),
    ("production", {**WITH_TOKEN, "peal_site_measurement": False}),
])
def test_without_the_switch_the_build_measures_nothing(environment: str, names: dict[str, Any]) -> None:
    args = _build_args(environment, **names)

    assert args == settings(environment)["peal_static_build_args"]


def test_each_image_gets_the_measurement_its_dockerfile_reads() -> None:
    """The static image builds the site and the docs, so it reads both; the
    docs server's image reads the docs' alone."""
    args = _build_args("production", **WITH_TOKEN)
    static = task("peal_release", "Build the static image")
    docs = task("peal_release", "Build the docs server's image")

    static_args = ansible_render(static["vars"]["peal_release_static_args"], peal_release_build_args=args)
    docs_args = ansible_render(docs["vars"]["peal_release_docs_args"], peal_release_build_args=args)

    assert set(MEASUREMENT_ARGS) <= set(static_args)
    assert {name for name in MEASUREMENT_ARGS if name.startswith("DOCS_")} <= set(docs_args)
    assert not [name for name in docs_args if name.startswith("SITE_")]
    # docker takes each argument's value from the task's environment.
    assert static["environment"] == docs["environment"] == "{{ peal_release_build_args }}"


# The preflight.

def _refused(**names: Any) -> list[str]:
    found = task("peal_preflight", "Refuse site measurement without PostHog's token")
    base = {"peal_site_measurement": False, "peal_settings": {}, "peal_static_build_args": {}, **found["vars"]}
    return ansible_render(found["vars"]["peal_preflight_site_measurement_refused"], **{**base, **names})


def test_the_preflight_takes_the_switch_with_the_token() -> None:
    assert _refused(peal_site_measurement=True, **WITH_TOKEN) == []
    assert _refused() == []
    assert _refused(peal_credentials={}) == []


@pytest.mark.parametrize("credentials", [None, {}, {"PEAL_POSTHOG_KEY": ""},
                                         {"PEAL_POSTHOG_KEY": "synthetic"}, {"PEAL_POSTHOG_KEY": "phc_"},
                                         {"PEAL_POSTHOG_KEY": "phc_synthetic token"}],
                         ids=["no vault", "empty vault", "empty", "not a token", "prefix", "space"])
def test_the_preflight_refuses_the_switch_without_the_vault_s_token(credentials: dict[str, str] | None) -> None:
    """The release builds the site on the machine running Ansible, from the
    vault: a token written on the server alone cannot reach the build."""
    names: dict[str, Any] = {"peal_site_measurement": True}
    if credentials is not None:
        names["peal_credentials"] = credentials

    assert _refused(**names) == ["peal_credentials.PEAL_POSTHOG_KEY"]


@pytest.mark.parametrize("name", ["PEAL_POSTHOG_SITE", "PEAL_POSTHOG_SITE_COOKIE_DOMAIN"])
def test_the_preflight_refuses_the_relay_s_site_mode_set_by_hand(name: str) -> None:
    assert _refused(peal_settings={name: "on"}) == [f"peal_settings.{name}"]


@pytest.mark.parametrize("name", [*MEASUREMENT_ARGS])
def test_the_preflight_refuses_measurement_build_arguments_set_by_hand(name: str) -> None:
    assert _refused(peal_static_build_args={name: "x"}) == [f"peal_static_build_args.{name}"]


def test_the_inventory_passes_the_preflight() -> None:
    for group in ["production", "sandbox"]:
        found = settings(group)
        assert _refused(**{**found, **WITH_TOKEN}) == []
