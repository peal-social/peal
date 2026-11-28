# Agent skills and the plugin

`peal-skills` (Apache-2.0) holds the agent skills, in the Agent Skills
format, one folder each under `skills/`, and is Peal's plugin: the same
folder, with a manifest for each client's format around them. A skill is
installed by copying its folder, so each keeps its own `LICENSE`. The
package has no build: the Nx project exists so that `peal-cli` and
`peal-site`, which read the skills, depend on it (`implicitDependencies`).

- `skills/peal/` is the agent skill: `SKILL.md` under 500 lines, more in
  `references/`. `packages/peal-cli/test/skill.test.ts` checks its
  frontmatter, that every `peal` command line and flag in its code blocks
  exists, that every HTTP path of its curl reference is in the contract, and
  that the error codes it lists are the catalogue's: change a command, the
  skill and the docs' command line page together. The site publishes it at
  `/.well-known/agent-skills/` (a draft's path: index 0.2.0, a `skill-md`
  with its SHA-256), from copies under `packages/peal-site/public/` that
  `bun packages/peal-site/src/write-agent-skills.ts` writes and a test
  keeps equal. `npx skills add peal-social/peal` finds it, and skills.sh
  lists what that command installs: there is nothing to submit.
- A new skill goes in `skills/<name>/` with its own `LICENSE`, in the site's
  `servedSkills` if the site serves it, and in this package's README.

## The plugin

- One plugin, `peal`, in three manifests that say the same name, version,
  description and licence, and connect to Peal Cloud's endpoint alone
  (`https://app.peal.social/api/mcp`, OAuth, no header):
  `plugin.json` and `mcp.json` (Agent Plugins 1.0.0, `streamable-http`),
  `.claude-plugin/plugin.json` and `.mcp.json` (Claude's, `http`), and
  `.cursor-plugin/plugin.json` (Cursor's, the server inline, so Cursor reads
  no other file for it). `packages/peal-cli/test/plugin.test.ts` keeps them
  equal and the ChatGPT listing inside its directory's limits; the
  repository's `.claude-plugin/marketplace.json` and
  `.cursor-plugin/marketplace.json` point at this folder. Raise the version
  in all three for every release a directory should pick up.
- ChatGPT's and Codex's settings are under `extensions."com.openai"` in
  `plugin.json` (OpenAI then ignores any `.codex-plugin/`): the listing's
  words, in English and French (`publication.translations`), and the
  review's five cases that use Peal and three that do not. Each case's
  `tools_triggered` names a tool the endpoint offers
  (`packages/peal-server/test/app/mcp-plugin.test.ts`): renaming an MCP
  tool changes them too. Never put a reviewer's credentials or
  instructions in the file: the portal takes them.
- Hermes Agent's are under `extensions."com.nousresearch.hermes"`: the
  server is `untrusted`, as its tools publish, send messages and spend.
  Hermes (0.23.5) signs in with OAuth only to the servers in its own
  `config.yaml`, never to a plugin's, so the docs add Peal's server there
  first (`hermes mcp add peal --url … --auth oauth`) with `trust:
  untrusted`: a `config.yaml` server of the same name replaces the
  plugin's, its trust included. Peal has no entry in Hermes's MCP
  catalog (`optional-mcps/`): the owner chose not to submit one.
  Hermes scans a plugin before installing it and refuses one from a
  community source on any critical finding, which no flag overrides. One
  is `curl` on the same line as a variable named `…KEY`, `…TOKEN`,
  `…SECRET`, `…PASSWORD` or `…CREDENTIAL`: every curl in a skill puts
  its `-H "Authorization: Bearer $PEAL_API_KEY"` on a continuation line
  of its own. `hermes plugins validate packages/peal-skills` runs the
  scan.
- ClawHub (OpenClaw's hub) releases every skill published there under
  MIT-0. The owner accepted that for ClawHub's copy (2026-11-28); the
  skills stay Apache-2.0 here and everywhere else. OpenClaw takes the
  plugin as a bundle in Claude's format (`--bundle-format claude`).
- `CLAUDE.md` at the plugin's root is the repository's convention; Claude
  does not load it from a plugin, and `claude plugin validate` warns about
  it, so validate without `--strict`:
  `claude plugin validate packages/peal-skills --profile directory`.
- A listing needs what the MCP endpoint already holds: every tool with a
  title and its read, destructive, idempotent and open-world hints
  (`src/app/mcp/annotations.ts`), OAuth with PKCE, and dynamic registration
  on (`MCP_DYNAMIC_REGISTRATION`), which Claude, ChatGPT and the other
  directories register through. Keep those true for Peal Cloud.
