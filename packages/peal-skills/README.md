# Peal's plugin and agent skills

This package is Peal's plugin for AI assistants and coding agents. It holds
Peal Cloud's MCP server (`https://app.peal.social/api/mcp`, which signs in
with OAuth) and the agent skills, in one folder that each client reads in
its own format.

- [`skills/peal/`](skills/peal/SKILL.md) teaches an agent to use Peal safely, through the
  `peal` command line and the HTTP API: signing in or using a workspace API
  key, drafting, scheduling and publishing posts, reading how they went, and
  handling errors and rate limits. Its skills follow the
  [Agent Skills](https://agentskills.io) format.

## Install

| Client                     | How                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Claude Code                | `/plugin install peal --marketplace peal-social/peal`                                                                      |
| Hermes Agent               | `hermes plugins install peal-social/peal/packages/peal-skills`, then `hermes plugins enable peal`                          |
| The skill alone, any agent | `npx skills add peal-social/peal`, or copy `skills/peal/` to where your agent reads skills                                 |
| Any other MCP client       | Add the remote server `https://app.peal.social/api/mcp` ([Connect an MCP client](https://docs.peal.social/developers/mcp)) |

Peal's site also serves the skill for discovery, at
`https://peal.social/.well-known/agent-skills/index.json`.

## What each client reads

| Files                                     | Format                                           | Read by                                                                                |
| ----------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `plugin.json`, `mcp.json`                 | [Agent Plugins](https://agent-plugins.org) 1.0.0 | ChatGPT and Codex (settings under `extensions.com.openai`), Hermes Agent, Cursor       |
| `.claude-plugin/plugin.json`, `.mcp.json` | Claude's plugins                                 | Claude Code, claude.ai, Claude's desktop app and Cowork; OpenClaw takes it as a bundle |
| `.cursor-plugin/plugin.json`              | Cursor's plugins                                 | Cursor                                                                                 |
| `skills/`                                 | Agent Skills                                     | every client above, and the `skills` command line                                      |
| `assets/logo.svg`                         |                                                  | the listings' logo                                                                     |

The repository's root holds the marketplaces that point at this folder:
`.claude-plugin/marketplace.json` for Claude Code and
`.cursor-plugin/marketplace.json` for Cursor.

## Privacy

The plugin connects to Peal Cloud, whose
[privacy policy](https://peal.social/privacy) and
[terms](https://peal.social/terms) apply. It acts in the one workspace you
pick when you sign in, with what you allow on Peal's consent page.

## Licence

The plugin and the skills are under the Apache License 2.0, unlike most of
the repository: each skill has its own `LICENSE`, so anyone may install,
change and share them.

## Keeping them true

[`packages/peal-cli/test/skill.test.ts`](../peal-cli/test/skill.test.ts) checks every `peal` command and flag,
every HTTP path and every error code a skill names against the command line
and the API's contract. Change a skill and the command line together.
[`packages/peal-cli/test/plugin.test.ts`](../peal-cli/test/plugin.test.ts) keeps the manifests saying the same
thing, and `packages/peal-server/test/app/mcp-plugin.test.ts` that the
review cases name tools the MCP server offers.
