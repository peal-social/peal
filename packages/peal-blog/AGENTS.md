# Blog

Peal's blog at `peal.social/blog` (English) and `/blog/fr/` (French): an
Astro site on the Node adapter, server-rendered, with EmDash as its CMS.
It runs as one more container of Peal's own production stack (the `blog`
profile of `compose.production.yaml`), with its own database and role on
the stack's Postgres and its own private bucket. A self-hoster does not run
it, so its settings are documented here and in the Ansible README, not on
the docs' environment variables page.

## Design

- **Same chrome as the site.** The header, the footer, the announcement
  bar, the tokens and the fonts are the site's: their data and strings come
  from `peal-ui/lib/site/*`, as the site's do, and `src/layouts/base.astro`
  follows the site's layout. The blog adds no visual pattern of its own:
  the index opens as the pricing page does and lists posts in bordered
  cells on the rails; a post uses the typography of the legal pages. Read
  DESIGN.md before changing a page; propose a DESIGN.md change rather than
  drift from it. Light only.
- **Asks and measures as the site does**, through peal-ui: the layout
  renders `<peal-consent>` and loads `peal-ui/lib/site/consent/start`, so
  the consent notice, its answer cookie and the measurement are the site's.
  Only the public layout has them: EmDash's admin is never measured.
- **URLs.** Pages under Astro's base (`BLOG_BASE`, `/blog` unless set):
  `/blog/`, `/blog/<slug>`, `/blog/fr/`, `/blog/fr/<slug>`, `/blog/404`,
  and EmDash's base-aware `/blog/sitemap.xml`. EmDash's admin and API
  ignore the base: they answer at the origin's root, `/_emdash/…`, on the
  same host name. The tunnel sends `/blog` and `/_emdash` to this
  container and nothing else of the host.
- **Never route or link `/blog/_emdash`.** Astro's router also matches a
  route with the base left out, and EmDash's checks only know `/_emdash`:
  under `/blog/_emdash/api` its auth middleware takes the call for a public
  page and skips its CSRF check. `src/guard.ts`, registered as a middleware
  ahead of EmDash's (`astro.config.ts`), answers 404 to any path under
  `<base>/_emdash` (any case, any encoding) and to every path outside the
  base but `/_emdash/…`; the tunnel refuses it too. The guard sees Astro's
  pathname, whose dot segments and backslashes are already resolved, so
  `/blog/%2e%2e/_emdash/api` would reach it as `/_emdash/api`: the
  production server is `server/serve.ts` (`node server/serve.ts`, the
  image's command), which answers 404 to a target sent with a dot segment,
  `%2e`, a backslash, `%5c` or `%25` (`server/raw-path.ts`) before
  handing the rest to the Node adapter's handler. Never start the build
  with `dist/server/entry.mjs` alone.
- **Every link goes through `src/links.ts`** (`blogLink`, on
  `import.meta.env.BASE_URL`). Build links from `entry.data.slug`, never
  `entry.id`. Page logic lives in typed `.ts` modules (`src/posts.ts`,
  `src/chrome.ts`): TypeScript 7 does not read `.astro` files. A page that
  may answer 404 looks the entry up and rewrites in the page itself: a
  component cannot rewrite once the page streams.
- **Development runs without the base** (`BLOG_BASE=/`): `astro dev`
  answers 404 to the admin outside the base. `nx run peal-blog:smoke`
  covers the base on a production build.
- **Database.** `postgres({})` with no connection settings: `pg` reads
  `PG*` when the server starts, so no credential is in the image (a
  connection string in the config would be baked into the bundle).
  Migrations run in `auto` mode when the runtime first starts, as Peal's
  server migrates when it starts: one instance, forward only; roll back by
  releasing the previous commit.
- **The schema lives in the database.** `seed/seed.json` only seeds an
  empty database (the `posts` collection, tags, the `Peal` byline). A field
  added later is added in the admin of each environment, and in the seed.
  `emdash-env.d.ts` is EmDash's types for that schema, written by `astro
  dev` (the first `nx run peal-blog:dev` against a database): commit it.
- **Media.** `s3()` with the `S3_*` variables, read at run time, in a
  bucket of the blog's own (EmDash has no key prefix, and the server's
  media sweeps own the media bucket). It stays private: media is read back
  through `/_emdash/api/media/file/<key>`, and Astro's image endpoint at
  `/blog/_image` resizes it with sharp. Cloudflare's edge caches
  `/blog/_image` for a day by its whole query (the Pulumi project's
  `site-cache` rule), and the guard answers 404 to a request Astro would
  not build (`src/image-request.ts`, stateless): another parameter, a
  source outside `/_emdash/api/media/file/`, a width or height that is not
  a whole number up to 4000, a format Astro does not output, a quality,
  or the endpoint spelled with a trailing slash. The smoke test fetches a
  real image URL a page writes, so an upgrade that changes those URLs
  fails CI. The admin uploads with a presigned `PUT` straight to the
  bucket, which needs the upload CORS rule (`scripts/cors.ts`). Set
  `AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED` (the image does): the
  AWS SDK otherwise signs a CRC32 of an empty body into the upload URL,
  and the store refuses the upload.
- **Purging an image.** EmDash's "Replace original" overwrites the file
  under the same key, and its URLs carry no hash in 1.5.0, so the edge may
  serve the old image for up to a day. To take one down at once (replaced,
  or deleted and must not show), purge it in Cloudflare's dashboard
  (peal.social, Caching, Configuration, Custom Purge): by URL, each
  `https://peal.social/blog/_image?…` address the page's source shows for
  it (`src` and `srcset`), or by prefix, `peal.social/blog/_image`, every
  resized image at once (a prefix purge ignores the query). The original
  at `/_emdash/api/media/file/<key>` is not cached at the edge.
- **First admin.** EmDash's setup wizard is first come, first served: in
  production Access guards `/_emdash` (but `/_emdash/api/media/file/`),
  and the sandbox is behind Access throughout. Complete the wizard right
  after the first release.
- **Off:** plugins and their sandbox, co-editing, comments (they would
  store readers' data, which the privacy policy and
  `peal-contract/data-processing` do not cover), search (EmDash's search is
  SQLite only), self sign-up, the update check, the admin's Comments,
  Menus, Redirects and Widgets.
- **Links the admin gets wrong.** The preview button leads to
  `<base>/<id>?_preview=…` (`EMDASH_PREVIEW_PATH_PATTERN`, set at build in
  `astro.config.ts`). "View Site" leads to `/` and "Live View" to
  `/<slug>`, without the base: EmDash builds them from the collection's
  pattern alone. Open a post from the blog instead.
- **Sessions.** Signed-in editors live in Astro's session, which the Node
  adapter writes under `node_modules/.astro/sessions`: a volume in
  production, so sign-ins survive a release.
- **Email.** EmDash's built-in SMTP transport, from `EMAIL_SMTP_*`, sends
  invitations and magic links; it requires TLS (587 with STARTTLS, or 465)
  and refuses port 25. In production it goes through Resend's SMTP relay,
  with a Resend key of the blog's own (`PEAL_BLOG_RESEND_API_KEY` in the
  stack's credentials, a sending-only key for the mail domain), never the
  server's `RESEND_API_KEY`.
  The development stack's Mailpit speaks plain SMTP, so `dev` sends none.

## Settings

| Variable                                                                                                           | When          | What                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BLOG_BASE`                                                                                                        | build, dev    | The base path: `/blog` unless set, `/` in dev.                                                                                                                                                                 |
| `BLOG_SITE_URL`                                                                                                    | build and run | The site's origin (`https://peal.social`). At build it sets Astro's `site` and turns EmDash's image optimisation on; at run time the header's links to the site and the icons use it (empty: the same origin). |
| `EMDASH_SITE_URL`                                                                                                  | run           | The same origin, for passkeys, origin checks and absolute URLs.                                                                                                                                                |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`                                                           | run           | The database.                                                                                                                                                                                                  |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`                                | run           | The media bucket.                                                                                                                                                                                              |
| `AWS_REQUEST_CHECKSUM_CALCULATION`, `AWS_RESPONSE_CHECKSUM_VALIDATION`                                             | run           | `WHEN_REQUIRED` (set in the image), see Media.                                                                                                                                                                 |
| `EMDASH_ENCRYPTION_KEY`                                                                                            | run           | Encrypts secrets saved in the admin: `emdash_enc_v1_` and 43 base64url characters.                                                                                                                             |
| `EMDASH_TRUSTED_PROXY_HEADERS`                                                                                     | run           | The header the edge gives the client's address in.                                                                                                                                                             |
| `BLOG_APP_URL`, `BLOG_DOCS_URL`, `BLOG_DISCORD_URL`                                                                | run           | As the site's `SITE_*`; unset or empty turns each off.                                                                                                                                                         |
| `BLOG_POSTHOG_KEY`, `BLOG_POSTHOG_HOST`, `BLOG_POSTHOG_COOKIE_DOMAIN`, `BLOG_POSTHOG_ENVIRONMENT`                  | run, optional | As the site's `SITE_POSTHOG_*`: measurement with PostHog and the consent notice, on only with a key and a host; a malformed value stops the server.                                                            |
| `BLOG_CRISP_WEBSITE_ID`                                                                                            | run, optional | As the site's `SITE_CRISP_WEBSITE_ID`: the support chat's launcher; a malformed value stops the server.                                                                                                        |
| `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_SECURE`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS`, `EMAIL_SMTP_FROM` | run, optional | EmDash's SMTP; unset, no mail.                                                                                                                                                                                 |
| `HOST`, `PORT`                                                                                                     | run           | The Node adapter's (`0.0.0.0`, `4324` in the image).                                                                                                                                                           |

## Work on it

- `bun nx run peal-blog:dev` serves the blog and the admin on
  `http://localhost:4324` against the development stack, after `setup`
  (`scripts/setup.ts`: the database `peal_blog`, the bucket `peal-blog`
  and its upload rule, on 127.0.0.1 only).
- `bun nx run peal-blog:smoke` builds with the base, runs the server on a
  database and bucket of its own, and checks the pages, the admin's
  redirect to its setup, the refused paths and the health check over
  HTTP. Run it after every EmDash upgrade, and read EmDash's changelog
  for migrations: they run when the new release starts.
- `test/` (vitest, no database) covers the links, the guard, the chrome,
  the settings, the seed and the setup script's rules.
