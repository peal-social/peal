# syntax=docker/dockerfile:1.28.0@sha256:bb22d9815c728170f72750f4e5b0d672e06176142e1d602c7e66c050100b7e5b

# Peal's blog (packages/peal-blog): EmDash on Astro's Node adapter, on Node,
# as a user without privileges. A self-hoster does not run it. Build it from
# the repository root:
#
#   bun nx run peal-docker:build-blog-image
#
# BLOG_SITE_URL, the public origin such as https://peal.social, is read at
# build time: it turns EmDash's image optimisation on. No credential is
# read at build: the database (PG*), the bucket (S3_*) and EMDASH_* come
# from the environment when the server starts (packages/peal-blog/AGENTS.md
# lists them).

FROM oven/bun:1.4.5-slim@sha256:b780593f3e10918cbdaec3d5a08d52224b9198069a65eb47812085c2ec007643 AS bun

FROM node:26.13.1-trixie-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc AS build

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

ENV ASTRO_TELEMETRY_DISABLED=1

# The blog takes its chrome from peal-ui, which reads the contract's
# platform lists.
COPY package.json bun.lock ./
COPY patches patches
COPY packages/peal-blog/package.json packages/peal-blog/
COPY packages/peal-contract/package.json packages/peal-contract/
COPY packages/peal-ui/package.json packages/peal-ui/

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts --filter peal-blog

COPY tsconfig.base.json ./
COPY packages/peal-blog packages/peal-blog
COPY packages/peal-contract packages/peal-contract
COPY packages/peal-ui packages/peal-ui

ARG BLOG_SITE_URL=""

RUN cd packages/peal-blog && BLOG_SITE_URL="$BLOG_SITE_URL" ./node_modules/.bin/astro build \
    && test -f dist/server/entry.mjs

# The server resolves its packages through the project's node_modules: the
# production dependencies alone, installed again without the build's tools.
FROM node:26.13.1-trixie-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc AS dependencies

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

COPY package.json bun.lock ./
COPY patches patches
COPY packages/peal-blog/package.json packages/peal-blog/
COPY packages/peal-contract/package.json packages/peal-contract/
COPY packages/peal-ui/package.json packages/peal-ui/

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --ignore-scripts --filter peal-blog

FROM node:26.13.1-trixie-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc

WORKDIR /app

# The AWS SDK otherwise signs a checksum of an empty body into the admin's
# upload URLs, and the bucket refuses the upload.
ENV NODE_ENV=production \
    ASTRO_TELEMETRY_DISABLED=1 \
    AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED \
    AWS_RESPONSE_CHECKSUM_VALIDATION=WHEN_REQUIRED \
    HOST=0.0.0.0 \
    PORT=4324

# The files belong to root and stay read-only.
COPY --from=dependencies /app/node_modules node_modules
COPY --from=dependencies /app/packages/peal-blog/node_modules packages/peal-blog/node_modules
COPY --from=build /app/packages/peal-blog/package.json packages/peal-blog/package.json
COPY --from=build /app/packages/peal-blog/dist packages/peal-blog/dist
# The server that checks each request target as sent, then hands it to the
# build's own handler (packages/peal-blog/server).
COPY --from=build /app/packages/peal-blog/server packages/peal-blog/server

# Signed-in editors' sessions: the Node adapter writes them under the
# build's cache folder, which the stack mounts a volume on.
RUN mkdir -p packages/peal-blog/node_modules/.astro/sessions \
    && chown node:node packages/peal-blog/node_modules/.astro/sessions

USER node

EXPOSE 4324

# EmDash's health check runs its start-up first: the migrations, and the
# seed on an empty database.
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --start-interval=1s --retries=3 \
    CMD ["node", "--eval", "fetch(`http://127.0.0.1:${process.env.PORT}/_emdash/api/health`).then((response) => process.exit(response.ok ? 0 : 1), () => process.exit(1));"]

CMD ["node", "packages/peal-blog/server/serve.ts"]
