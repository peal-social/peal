import { describe, expect, it } from "bun:test";

import { everything, outsideProjects, plan } from "./ci-plan.ts";

const roots = [
  "packages/peal-blog",
  "packages/peal-cli",
  "packages/peal-contract",
  "packages/peal-docker",
  "packages/peal-docs",
  "packages/peal-e2e",
  "packages/peal-emails",
  "packages/peal-infra/ansible",
  "packages/peal-infra/pulumi",
  "packages/peal-sdk",
  "packages/peal-sdk/node",
  "packages/peal-server",
  "packages/peal-site",
  "packages/peal-skills",
  "packages/peal-ui",
  "packages/peal-web",
];

const none = {
  ansible: false,
  blog: false,
  e2e: false,
  sdks: false,
  server: false,
};

describe("the CI plan", () => {
  it("runs the end-to-end run for a change to the site, which it measures", () => {
    expect(
      plan({
        // The run serves the site's build: peal-e2e names it as an implicit
        // dependency.
        affected: ["peal-site", "peal-e2e"],
        files: ["packages/peal-site/src/pages/index.astro"],
        roots,
      })
    ).toEqual({ ...none, e2e: true });
  });

  it("runs the end-to-end run for a change to the site's consent and measurement in peal-ui", () => {
    expect(
      plan({
        affected: ["peal-ui", "peal-site", "peal-docs", "peal-web", "peal-e2e"],
        files: ["packages/peal-ui/src/lib/site/consent/element.ts"],
        roots,
      }).e2e
    ).toBe(true);
  });

  it("runs the server's tests, Ansible's and the end-to-end run for a server change", () => {
    expect(
      plan({
        affected: ["peal-server", "peal-e2e"],
        files: ["packages/peal-server/src/main.ts"],
        roots,
      })
    ).toEqual({ ...none, ansible: true, e2e: true, server: true });
  });

  it("runs the server's tests and the end-to-end run for a change to the emails, which the server renders", () => {
    expect(
      plan({
        affected: ["peal-emails", "peal-server", "peal-e2e"],
        files: ["packages/peal-emails/src/catalog/english.ts"],
        roots,
      })
    ).toEqual({ ...none, e2e: true, server: true });
  });

  it("runs Ansible's tests too for a picture the emails show, which the tunnel's test reads", () => {
    expect(
      plan({
        affected: ["peal-emails", "peal-server", "peal-e2e"],
        files: ["packages/peal-emails/src/assets/header.png"],
        roots,
      })
    ).toEqual({ ...none, ansible: true, e2e: true, server: true });
  });

  it("runs Ansible's tests too for a legal page, whose company the emails name", () => {
    expect(
      plan({
        affected: ["peal-site", "peal-e2e"],
        files: ["packages/peal-site/src/content/legal/en/terms.md"],
        roots,
      })
    ).toEqual({ ...none, ansible: true, e2e: true });
  });

  it("runs the SDKs for a contract change, which the project graph does not link", () => {
    expect(
      plan({
        affected: ["peal-contract", "peal-server", "peal-e2e", "peal-web"],
        files: ["packages/peal-contract/src/index.ts"],
        roots,
      }).sdks
    ).toBe(true);
  });

  it("runs the SDKs for a change to one SDK", () => {
    expect(
      plan({
        affected: ["peal-sdk-node"],
        files: ["packages/peal-sdk/node/src/index.ts"],
        roots,
      })
    ).toEqual({ ...none, sdks: true });
  });

  it("runs the server's tests for a docs change, since one of them reads the docs", () => {
    expect(
      plan({
        affected: ["peal-docs"],
        files: ["packages/peal-docs/docs/index.mdx"],
        roots,
      })
    ).toEqual({ ...none, server: true });
  });

  it("runs the server's tests for a change to the plugin's manifest, whose review cases name tools", () => {
    expect(
      plan({
        affected: ["peal-skills", "peal-cli", "peal-site"],
        files: ["packages/peal-skills/plugin.json"],
        roots,
      })
    ).toEqual({ ...none, server: true });
  });

  it("runs the server's tests, the end-to-end run and the blog's smoke test when the compose file changes", () => {
    expect(
      plan({
        affected: ["peal-docker"],
        files: ["packages/peal-docker/compose.yaml"],
        roots,
      })
    ).toEqual({ ...none, ansible: true, blog: true, e2e: true, server: true });
  });

  it("runs the blog's smoke test alone for a blog change", () => {
    expect(
      plan({
        affected: ["peal-blog"],
        files: ["packages/peal-blog/src/posts.ts"],
        roots,
      })
    ).toEqual({ ...none, blog: true });
  });

  it("runs the blog's smoke test for a peal-ui change, which Nx finds affects the blog", () => {
    expect(
      plan({
        affected: ["peal-ui", "peal-site", "peal-web", "peal-blog"],
        files: ["packages/peal-ui/src/lib/site/navigation.ts"],
        roots,
      }).blog
    ).toBe(true);
  });

  it("does not run the blog's smoke test for a site change", () => {
    expect(
      plan({
        affected: ["peal-site"],
        files: ["packages/peal-site/src/pages/index.astro"],
        roots,
      }).blog
    ).toBe(false);
  });

  it("runs every job for a change outside every project", () => {
    const change = { affected: [], files: [".github/workflows/ci.yml"], roots };
    expect(outsideProjects(change)).toEqual([".github/workflows/ci.yml"]);
    expect(plan(change)).toEqual(everything);
  });

  it("runs no long job for prose outside every project", () => {
    expect(
      plan({
        affected: [],
        files: [
          "AGENTS.md",
          ".github/CONTRIBUTING.md",
          "packages/peal-infra/DEPLOYMENT.md",
        ],
        roots,
      })
    ).toEqual(none);
  });

  it("runs Ansible's tests for DESIGN.md, which the uptime page's test reads", () => {
    expect(plan({ affected: [], files: ["DESIGN.md"], roots })).toEqual({
      ...none,
      ansible: true,
    });
  });

  it("does not take a project for another whose name it starts", () => {
    expect(
      outsideProjects({
        affected: [],
        files: ["packages/peal-sdk-extra/file.ts"],
        roots,
      })
    ).toEqual(["packages/peal-sdk-extra/file.ts"]);
  });
});
