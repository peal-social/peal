# Pulumi

Read the [README](README.md) first: the projects, the state, the
credentials and how to adopt what exists.

- Change Cloudflare only through this project, and run `preview --diff`
  before every `up`. A change made in the dashboard shows as drift in the
  next preview: bring it into the code or undo it.
- `src/` holds the resources, as functions of a stack's decoded settings
  (`src/settings.ts`, Effect Schema); `account/index.ts` and
  `environment/index.ts` are the programs Pulumi runs. Tests run them against
  Pulumi's mocks (`test/support.ts`) and never reach Cloudflare.
- No secret in code or in a `Pulumi.<stack>.yaml` in clear: a stack's
  secrets (the owner's address) are set with `pulumi config set --secret`,
  encrypted with the passphrase, and the secrets it makes (the tunnel's
  token, the buckets' keys) are secret outputs, which only the Ansible
  project's `scripts/cloudflare_from_pulumi.py` reads.
- Resources live in components (`src/account.ts`, `src/environment.ts`).
  What holds data or routes traffic is `protect`ed, and buckets are
  `retainOnDelete`.
- The short-link domain (peal.link) is a zone of its own, in the account
  project (`src/link-domain.ts`): a zone has one ruleset per phase, so its
  redirect and rewrite rules stay there, for every environment's host name
  on it; each environment's stack makes its own record, to its tunnel.
  Short links in production are public, with no Access application; the
  tunnel lets `/api/l/` and a code alone through (the Ansible project's
  cloudflared role): keep the rewrite and that route in step. The rewrite
  leaves `/cdn-cgi/` and `/api/l/` paths alone, and relies on the zone's
  URL normalisation, which stays on, in code.
- HTTPS is in code on both zones (`src/https.ts`): HTTP redirected to
  HTTPS, TLS 1.2 at least, and HSTS (`security_header`) with the web app's
  value (`packages/peal-web/next.config.ts`: two years, subdomains, no
  preload), which the static image's nginx sends too
  (`packages/peal-docker/config/static/default.conf`): change the three
  together. The main zone's settings and its incoming URL normalisation
  are the account stack's (`src/account.ts`), the link domain's its own.
  A zone setting's `value` reaches Cloudflare's API as written, so an
  object's keys are the API's, in snake case.
- Resource names (the first argument) are what the state knows a resource
  by: renaming one makes Pulumi delete it and make it again. Use an alias.
- The sandbox is applied, as production will be: `test/sandbox-resources.ts` pins
  every resource the sandbox's stack makes, by name and inputs, so a change
  there is one its preview shows. Change it only with a change the sandbox
  is meant to take, and preview both stacks before `up`.
- On the sandbox, what outside services call is opened by
  `access-callbacks` (`publicCallbackPaths`): Bluesky's documents,
  Stripe's events, Meta's data deletion requests and its events
  (`api/platform-events`), each checked by the server. A path added there
  joins the Ansible project's `peal_access_bypass_paths` and
  `tests/test_cloudflared.py` in the same change. The web app's error
  reports, which browsers send without cookies, have their own Bypass
  application, `access-client-errors`, on `/api/client-errors` alone
  (`clientErrorsPath`, which that test reads), and so have the pictures
  emails show, which mail services fetch: `access-email-assets`, on
  `/api/email-assets` alone (`emailAssetsPath`, which it reads too).
- Production is public but for its admin, Grafana and SSH: no Access
  application covers its app, site, docs or short links. Its admin
  application's paths (`adminPaths`) are the Ansible project's
  `peal_access_paths`: change both together.
- The uptime server's part (README.md, "The uptime server"): its records
  in the account's stack, from the optional `peal:uptime` setting, never
  proxied, its addresses a secret setting and secret in the state, so no
  server's address is in Git in clear; the sandbox's service token for its
  checks, let into `access-app` alone by a Service Auth policy that
  includes that token alone, after the owner's. Production has none: its
  checks are public. The token's client id and secret reach the uptime
  server's vault through `scripts/cloudflare_from_pulumi.py --vault-id
  uptime@…`.
- The blog (`packages/peal-blog`): each environment has a private bucket
  of its own (`peal-<env>-blog`), its key, a lifecycle rule and the CORS
  rule its admin's uploads need (PUT, `content-type`, the site's origin),
  output as `blogBucket` and `blogKey`. In production, Access guards the
  site's `/_emdash` (`access-blog`, the owner's policy; its tag is
  `accessAud.blog`), and `access-blog-media` opens
  `/_emdash/api/media/file` with the Bypass policy, as the pages show
  those files; the Ansible project's cloudflared role routes the same
  paths. The sandbox needs neither: `access-app` covers its site. The
  account stack's `site-redirect` ruleset (the zone's one ruleset of the
  dynamic redirect phase) sends `blog.<domain>`, a proxied `AAAA 100::`
  record with no origin, to `<domain>/blog`, path and query kept, and its
  `site-cache` ruleset (the zone's cache settings phase) caches
  `<domain>/blog/_image` at the edge for a day by its whole query, never
  an error, which the blog's refusal of requests Astro would not build
  keeps from being bypassed. A day, not more: EmDash overwrites a replaced
  image under the same key, with no hash in its URLs. Production's names alone: the sandbox is
  behind Access.
- The backup copy (`backupCopy`, off unless `on`: a paid resource the
  owner approves): its bucket, lock, lifecycle and key
  (`test/environment-backup-copy.test.ts`). The lock stays 14 days above the
  Ansible project's refresh (21 days) and below the lifecycle, and its
  days match the Ansible project's `peal_backup_copy_lock_days`.
- Pin `@pulumi/pulumi` and `@pulumi/cloudflare` exactly, as everything else.
