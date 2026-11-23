# Infrastructure

How servers are changed, where secrets stay and what needs the owner's
approval are in the root [`AGENTS.md`](../../../AGENTS.md), under Infrastructure.

- Production runs on a server at a European provider, managed with Ansible
  from `peal-infra`, reachable only through a Cloudflare Tunnel: no inbound
  ports, SSH included. Each group's `hosting_provider` and
  `hosting_location` (a city) say where its server is: production's are set
  (a dedicated server in Paris), the sandbox's and the uptime server's are
  placeholders `peal_preflight` refuses until each is hosted, and the infra
  README's "Choosing a provider and a size" says what the stack needs of any
  provider. A server's address may stay off Git, in
  `host_vars/<host>/local.yml`.
  Cloudflare Zero Trust Access guards Grafana, the admin (`/api/auth/admin`,
  the staff console's `/api/admin`, `/admin`, `/en/admin` and `/fr/admin`) and the
  sandbox, and cloudflared checks the Access token on those routes too. Caddy fronts the
  stack for self-hosters.
- Staff have full access to Grafana: in production, Grafana signs in whoever
  its Access application lets through (the staff) as an organisation Admin,
  from the Access token (`GF_AUTH_JWT_ROLE_ATTRIBUTE_PATH` in
  `compose.production.yaml`), and sets the role again at each sign-in. Who
  gets in is the Access policy's business; do not grant roles in Grafana by
  hand.
- `bootstrap.yml` logs in as `bootstrap_user`, the account a server's image
  lets in: root, or the image's own (then with sudo, whose password, when it
  asks one, `scripts/become-keychain.py` reads from the keychain without
  showing it), which the `ssh` role removes once `ops` works. Where
  cloud-init rewrites `/etc/hosts` (`manage_etc_hosts`), the `system` role
  turns it off in `cloud.cfg.d/zz-peal.cfg` and writes its line in
  cloud-init's template too, as a provider's own settings at boot override
  files on the server.
- A unit a server's image runs for nothing is masked
  (`system_masked_units`, per group), never removed with its package:
  removing one can take Ubuntu's metapackages, whose other dependencies the
  unattended upgrades then remove. The `system` role keeps the clock with
  chrony on every server it runs on (not on a shared uptime host).
- Keep check mode working on a new server: a task that needs what an earlier
  one would make (a folder, a package, a unit) skips in check mode when that
  one reports a change.
- Docker Engine and its plugins are pinned exactly (`docker_packages` in the
  docker role, held by an apt pin); the role's defaults say how to bump them.
- Short links are on `peal_short_link_hostname` (peal.link in production,
  public; sandbox.peal.link, behind Access with the rest of the sandbox):
  Cloudflare's edge rewrites `/<code>` to `/api/l/<code>` (the Pulumi
  project's `src/link-domain.ts`), cloudflared sends that path alone to the
  server and answers 404 to anything else on the host, and `peal_runtime`
  sets `PEAL_SHORT_LINK_BASE` from it, so the base and the route never
  disagree. Changing the host name breaks the links already sent. The
  preflight refuses a host name that is not plain lower case (the server
  stops on one), and `PEAL_SHORT_LINK_BASE` in `peal_settings`; a test ties
  the tunnel's code pattern to the server's `codeLength` and alphabet, and
  Gatus follows an unknown code on each short-link host (`short_links` in
  `uptime_environments`). Each environment's Pulumi stack makes its record
  in the peal.link zone; never `cloudflared tunnel route dns`, which can
  put it in peal.social's.
- Compose recreates a container only when its service's definition
  changes, and a mount names `/srv/peal/current/…` whatever release that
  points at: `release.yml` hashes the files each service mounts from the
  release folder (`files/config_hashes.py`, from `docker compose config`,
  printing the hashes alone) into `release.env` as
  `PEAL_<SERVICE>_CONFIG_HASH`, which the service's
  `social.peal.config-hash` label reads, so exactly the services whose
  files changed are recreated, on a roll-back too, and a second release of
  the same commit changes nothing (`tests/test_release_config.py`, with
  Docker). It runs from a copy on the server with the command module:
  over SSH, `ansible.builtin.script` runs in a pseudo-terminal, which
  mixes stderr into the stdout a task parses.
- `peal_preflight` checks the `PEAL_POSTGRES_*` memory settings in
  `peal_settings` (a whole number with `kB`, `MB`, `GB` or `TB`; a number
  for the page cost) before `release.yml` stops anything: Postgres stops at
  start on a value it cannot read.
- An app's id in `peal_settings` (`SLACK_CLIENT_ID`, `X_CLIENT_ID`…)
  makes its secret a required credential (`peal_runtime_required_credentials`),
  as the server refuses to start with one half of an app alone: a new
  platform's pair joins that list. An id may require several:
  `PEAL_POSTHOG_PROJECT_ID` requires `PEAL_POSTHOG_KEY` and
  `PEAL_POSTHOG_PERSONAL_API_KEY`, and `PEAL_POSTHOG_KEY` among the
  credentials requires the project's id in turn (the role's assertion,
  `peal_runtime_posthog_on`), so Peal's servers capture only where they
  can also delete erased persons there;
  `PEAL_POSTHOG_ENVIRONMENT` is `peal_environment`.
- The site, the docs and the blog are measured behind
  `peal_site_measurement` (README.md, "Site measurement"): off by
  default, on in production; the sandbox keeps it off, as its host names
  under peal.social would share production's answer cookie. With it, the
  tunnel sends `^/+pulse/+site/` on the site's and the docs' host names,
  and nothing else of them, to the web app's relay, ahead of their other
  rules; `host.env` gains `PEAL_POSTHOG_SITE` and
  `PEAL_POSTHOG_SITE_COOKIE_DOMAIN`, and the blog's `BLOG_POSTHOG_*`; the
  release builds the static and docs images with `peal_release_build_args`
  (the inventory's `peal_static_build_args` and the `SITE_POSTHOG_*`,
  `DOCS_POSTHOG_*` and `DOCS_PRIVACY_URL` the switch derives). The token is
  the vault's `PEAL_POSTHOG_KEY`, read on the machine that builds, so
  `peal_preflight` refuses the switch without it there, and refuses those
  settings set by hand. Without the switch, the tunnel, `host.env` and the
  build arguments carry none of it (`tests/test_site_measurement.py`).
- Containers publish ports on 127.0.0.1 only, and the tunnel reaches them
  there; Docker's own rules would otherwise bypass ufw.
- A separate server checks uptime (`uptime.yml`, inventory group
  `uptime`), at another provider and in another city than production and
  the sandbox, which the `uptime` role refuses to run without and
  `tests/test_hosting.py` checks: Gatus, its configuration generated from the inventory, checks
  the public endpoints of production and the sandbox and alerts on a
  Telegram bot of its own, the sandbox's checks in the sandbox's chat
  (`telegram: true`), and on Slack beside it once its webhooks are set
  (the sandbox's in `#alerts-sandbox`, `slack: true`), only on an incident,
  never a blip (the role's thresholds). Slack is optional, there as in
  Grafana (`peal_runtime` mounts `telegram-slack.yaml` only with
  `SLACK_ALERTS_WEBHOOK_URL`, and `release.yml` refuses, before it changes
  anything, a `host.env` that names it while `credentials.env` lacks the
  webhook, on which Grafana would not start, and a commit that lacks a file
  of the release folder `host.env` names for a mount, such as one older than
  the last `site.yml`, on which Docker would mount an empty folder): with
  its webhooks unset, every rendered
  file stays as it was, which `tests/test_uptime.py` checks. The platform
  watch (`files/platform_watch.py`, the standard library's alone, tested in
  `tests/test_platform_watch.py` on synthetic pages, never the internet)
  runs there too, as `gatus`, from a timer installed only with
  `SLACK_CHANGELOG_WEBHOOK_URL`; Caddy is its only public entry, for the heartbeat
  production's Grafana posts every few minutes, on `uptime_hostname`, and
  for the public status page, on `uptime_status_hostname`
  (status.peal.social, `uptime_public_status: true`). It shares no secret,
  tunnel or network with them: it generates the heartbeat token, which
  production holds as a credential (`PEAL_HEARTBEAT_TOKEN`). Keep
  `uptime_environments` equal to each environment's host names. Gatus
  publishes its dashboard on 127.0.0.1 only. The status page is a Gatus of
  its own (`status`, `status-config.yaml.j2`) that checks the
  customer-facing endpoints of the environments marked `public`
  (production; never one behind Access), with no alert or secret, and
  hides URLs, conditions and errors, in Peal's design (`DESIGN.md`: the web
  app's mark and peal-ui's Geist, copied to `uptime_brand_root`, and
  `status.css`), light only; Caddy serves it by GET and HEAD alone
  (`status.caddy`), and the heartbeats never go through its name. Both names have DNS
  records Cloudflare does not proxy (the infra README's "The status page"),
  which the account's Pulumi stack makes; the sandbox's Pulumi stack makes
  the service token its checks of the sandbox carry, and
  `scripts/cloudflare_from_pulumi.py --vault-id uptime@…` writes it into
  `group_vars/uptime/vault.yml`, and nothing else of a stack.
- The uptime server may be a host the owner uses for other sites
  (`uptime_shared_host: true`, in its Git-ignored `local.yml`): `uptime.yml`
  skips every task of `system`, `ssh`, `docker` and `firewall` there, and
  `bootstrap.yml` refuses it. On it the `uptime` role changes nothing of
  the host's own (no package, setting, firewall rule, or account but
  `gatus`), publishes Gatus on 127.0.0.1 alone, on ports it checks are
  free, and serves the names through the host's Caddy from one site file,
  validated with the whole configuration as Caddy's user before a reload
  and taken out when Caddy refuses it. A change to the role leaves the
  dedicated server's rendered files as they were unless it means to change
  them; `tests/test_uptime_shared_host.py` covers the shared host.
- Postgres archives its write-ahead log and is backed up to R2 with
  pgBackRest; the backup passphrase is the one secret kept outside the server
  too. R2 buckets are in its EU jurisdiction (`<account>.eu.r2…`).
  `peal_runtime` refuses an R2 endpoint without `.eu.`; any other S3 store in
  the EU does, with its region in `peal_settings`. A restore
  brings back deletions made since its point in time:
  `runbooks/restore-database.md` restores the database, then replays the
  erasure ledger before the stack starts. The ledger stays in the media
  bucket while nothing serves that bucket publicly; `peal_runtime` refuses
  `PEAL_MEDIA_PUBLIC_BASE_URL` without `peal_erasure_ledger_bucket`. The server migrates when it
  starts, so write migrations that the previous release can still run
  against, and roll back by releasing the previous commit.
- The backup copy (`peal_backup_copy`, off by default, a paid resource:
  README.md, "The backup copy") copies the backups into a bucket whose
  lock keeps every object 35 days (the Pulumi stack's `backupCopy`). It
  never writes a key twice: each run under a prefix of its own, an index
  last with each copy's SHA-256, nothing when nothing changed. Every file
  the newest index names has a copy younger than the refresh
  (`peal_backup_copy_refresh_days`, 21), which stays 14 days below the
  lock, and the lock's days are the same in both projects; the store's
  times, never a run's name, say which runs to trust
  (`tests/test_backup_copy.py`: SeaweedFS, and a store with a clock over
  two months). Nothing the copy bucket holds may stop a command: parse
  whatever is read from it where it is read, and make a failure local to
  that run or object (an untrusted or unreadable run), never an exception
  out of `copy`, `runs` or `rebuild`.
- The disks' health goes to the collector as the backups' does:
  `peal_disks` posts gauges of the md arrays and of SMART, and Grafana's
  rules alert on them (`peal-docker`'s `rules.yaml`), with no mail
  transport or credential on the host. Never fail a disk, on any server,
  to test it: the script is tested on a made-up `/sys`
  (`tests/test_disks.py`), the rules by their expressions. The nightly
  reboot is `peal-reboot`'s (the `system` role), not unattended-upgrades':
  it holds a pending reboot while an md array is degraded.
- `site.yml` restarts the server when the privacy declaration changes (the
  server reads it at startup), refuses to remove the image's account while
  connected as it, and takes a storage endpoint only in the EU: R2's `.eu.`
  endpoints, or another store's host listed in `peal_storage_eu_hosts` once
  the owner checked it; hosts are compared without case or port. A ledger
  bucket that is the media bucket is not one of its own.
- An environment with a Pulumi stack (the sandbox and production) takes
  its Cloudflare values from it: `scripts/cloudflare_from_pulumi.py` writes
  `group_vars/<environment>/cloudflare.yml` (generated, committed, never
  edited by hand) and the tunnel's token and buckets' keys into the vault.
  Change them in `packages/peal-infra/pulumi`, then run the script. The
  script maps each stack's audience tags onto the inventory's
  (`AUD_NAMES`): production's `admin` application covers
  `peal_access_paths`, so a path added there is added to the Pulumi
  project's `adminPaths` too.
- The server signs in to Postgres as `peal_server`, never the superuser
  (`PEAL_DATABASE_USER` in `host.env`, `PEAL_DATABASE_PASSWORD` in
  `secrets.env`, which compose.production.yaml builds `DATABASE_URL`
  from). `release.yml` makes the role, keeps its password in step and,
  at every release, gives it Peal's database and whatever the superuser
  owns there (`tests/test_release_server_role.py`, on a new database
  migrated by the role and on one the superuser migrated). A migration
  needs nothing a database owner lacks: schemas, trusted extensions such
  as `pg_trgm`, advisory locks; one that needs a superuser (an untrusted
  extension, `ALTER SYSTEM`) cannot run, and goes in the release as a
  superuser step instead.
- Peal's blog runs behind `peal_blog`, off by default (README.md, "The
  blog"): with the flag off, every rendered file stays as it was
  (`tests/test_blog.py`). On the site's host name the tunnel refuses
  `/blog/_emdash` (any case), sends `/_emdash/api/media/file/` and `/blog`
  to the blog, and `/_emdash` too, behind the blog's own Access
  application in production (`cloudflare_access_aud.blog`, from the
  stack's `accessAud.blog`); nothing else of the host. Its database role's
  password goes from `secrets.env` to psql through the environment alone
  (`docker exec --env NAME`), as Postgres's does.
- `tests/` runs in parallel, a worker a CPU (pytest-xdist, in
  `pyproject.toml`), in any order: a test shares nothing with another but
  what it only reads. Name each container and network for the run
  (`secrets.token_hex`), publish no fixed host port, write only in
  pytest's temporary folders, and keep a random value out of a test's id
  (`ids=`), since every worker collects the tests and they must agree on
  the names. The tests that use a module's fixture that starts containers
  are one class: `tests/class_scheduling.py` hands a class's tests to one
  worker, which starts the containers once, and every other test on its
  own (`xdist_group` does not group with pytest 9.2 and xdist 3.8.0).
  CI splits the suite between two jobs by the same classes:
  `PEAL_PYTEST_SHARD=<index>/<total>` keeps one shard's tests (`shard`,
  whole classes, the largest first, to the shard with the fewest tests),
  so a test that needs another class's containers must not rely on
  running beside it.
  Templates the tests only read come from `rendered_with` (conftest),
  which renders each set of settings once a run for all the workers; a
  test that changes the files renders its own with `render_inventory`.
