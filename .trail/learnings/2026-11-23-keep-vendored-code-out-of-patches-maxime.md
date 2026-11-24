---
title: "Keep vendored code out of patches, and delete abandoned branches, because the secrets scan reads every branch"
author: Maxime
date: 2026-11-23
branch: feat/studio-editor-sdk
cost: { minutes: 107, tokens: 781923 }
id: l-6aeb58f6
scope: repo
status: active
src: agent
touches:
  - DESIGN.md
  - README.md
  - bun.lock
  - package.json
  - packages/peal-cli/AGENTS.md
  - packages/peal-cli/src/commands/media-slideshow.ts
  - packages/peal-cli/test/parity.test.ts
  - packages/peal-cli/test/slideshow-commands.test.ts
  - packages/peal-contract/src/workspace-slug.ts
  - packages/peal-docs/docs/developers/cli/posts.mdx
---

## Decided
A patch of a third-party package rewrites only what it must (a few constants, a notice). Anything else is changed at runtime. The first patch of Shotstack's Studio SDK rewrote every Google font address in its catalogue, about 830 KB. The secrets scan read one font file name (`tss_…`) as a "thunderstore-api-token" and failed CI. A false positive still fails the check. Filtering it would widen the filter for one file, which AGENTS.md forbids.

## Watch out
- CI's secrets job runs `betterleaks git .` on a full-depth checkout, which fetches every branch on GitHub, not only the PR's. A flagged commit left on an abandoned remote branch fails every other PR until that branch is deleted. Rewriting your own branch is not enough.
- Run the scan locally on all refs (`betterleaks git . --config .betterleaks.toml --confidence medium`), not only `--log-opts=origin/main..HEAD`, to see what CI sees.
- CodeQL flags `new RegExp(...)` built from host names ("incomplete regular expression for hostnames") even when the dots are escaped. Use a plain string search instead.

In the code: packages/peal-web/scripts/relay-studio-assets.ts (constants only, string search); packages/peal-web/src/components/studio/studio-engine.ts `relayFetches` (wraps fetch and FontFace while the editor runs); patches/@shotstack%2Fshotstack-studio@2.33.1.patch (about 5 KB).
