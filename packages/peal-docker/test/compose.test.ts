// The rules the stacks and the images keep, checked without Docker: ports on
// 127.0.0.1 only, exact image versions, no image mounts, a health check on
// every service but the one-shot ones, production services that restart (the
// one-shot ones never), run read-only and gain no privileges, a
// server that gets 75 seconds to stop and every setting the docs list, and
// images on the workspace's Bun and Node versions that run without
// privileges.
import { readFileSync } from "node:fs";
import path from "node:path";

import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const read = (...segments: readonly string[]): string =>
  readFileSync(path.join(import.meta.dirname, ...segments), "utf-8");

// Short volume syntax is a string; the long syntax, image mounts included, is
// an object.
const Mount = Schema.Struct({ source: Schema.String, type: Schema.String });

const isMount = Schema.is(Mount);

// `volume:target[:options]`.
const isShortVolume = Schema.is(Schema.String);

const Volume = Schema.Union([Schema.String, Mount]);

const ServiceSchema = Schema.Struct({
  build: Schema.optionalKey(
    Schema.Struct({
      args: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
      dockerfile: Schema.String,
    })
  ),
  command: Schema.optionalKey(Schema.Array(Schema.String)),
  depends_on: Schema.optionalKey(
    Schema.Record(Schema.String, Schema.Struct({ condition: Schema.String }))
  ),
  // `NAME:` with no value passes NAME through from Compose's environment.
  environment: Schema.optionalKey(
    Schema.Record(Schema.String, Schema.NullOr(Schema.String))
  ),
  healthcheck: Schema.optionalKey(
    Schema.Struct({ test: Schema.NonEmptyArray(Schema.String) })
  ),
  image: Schema.String,
  network_mode: Schema.optionalKey(Schema.String),
  networks: Schema.optionalKey(Schema.Array(Schema.String)),
  profiles: Schema.optionalKey(Schema.Array(Schema.String)),
  ports: Schema.optionalKey(Schema.Array(Schema.String)),
  read_only: Schema.optionalKey(Schema.Boolean),
  restart: Schema.optionalKey(Schema.String),
  security_opt: Schema.optionalKey(Schema.Array(Schema.String)),
  shm_size: Schema.optionalKey(Schema.String),
  stop_grace_period: Schema.optionalKey(Schema.String),
  volumes: Schema.optionalKey(Schema.Array(Volume)),
});

type Service = typeof ServiceSchema.Type;

const Compose = Schema.Struct({
  networks: Schema.optionalKey(
    Schema.Record(
      Schema.String,
      Schema.Struct({ internal: Schema.optionalKey(Schema.Boolean) })
    )
  ),
  services: Schema.Record(Schema.String, ServiceSchema),
});

const composeOf = (file: string) =>
  Schema.decodeUnknownSync(Compose)(
    // Merge keys share settings between services.
    parse(read("..", file), { merge: true })
  );

const servicesOf = (file: string): [string, Service][] =>
  Object.entries(composeOf(file).services);

const development = servicesOf("compose.yaml");
const production = servicesOf("compose.production.yaml");
const selfHost = servicesOf("compose.self-host.yaml");

// The variables the docs' environment variables page lists for the server:
// the first column of the tables under "Server", before "Web app".
const documentedServerSettings = (() => {
  const page = read(
    "..",
    "..",
    "peal-docs",
    "docs",
    "self-hosting",
    "environment-variables.mdx"
  );

  const server = page.slice(
    page.indexOf("\n## Server"),
    page.indexOf("\n## Web app")
  );

  return [...server.matchAll(/^\| `(?<name>[A-Z][\dA-Z_]*)`/gmu)].map(
    (row) => row.groups?.["name"] ?? ""
  );
})();

// An exact version: a tag with a digit in it, never a moving name like latest.
const isPinned = (image: string): boolean => {
  const tag = image.split("@").at(0)?.split(":").at(1) ?? "";

  return /\d/u.test(tag) && !tag.startsWith("latest");
};

// A tag for reading, then the digest that fixes the bytes.
const isPinnedByDigest = (image: string): boolean =>
  /^[^@\s]+:[^@\s]+@sha256:[\da-f]{64}$/u.test(image);

// `setting=${PEAL_POSTGRES_<VARIABLE>:-<default>}` in Compose's syntax.
const fallback = (setting: string, variable: string, value: string): string =>
  `${setting}=\${PEAL_POSTGRES_${variable}:-${value}}`;

// Docker mounts an image's files when it creates the container, and not
// again when the daemon restarts: the container then restarts on an empty
// folder (Engine 29.9, both architectures).
const mountedImages = (service: Service): string[] =>
  (service.volumes ?? [])
    .filter(isMount)
    .filter((mount) => mount.type === "image")
    .map((mount) => mount.source);

// A one-shot service runs to completion before the services that wait for
// it start, so it has no health check to pass and never restarts.
const oneShotNames = (services: [string, Service][]): Set<string> =>
  new Set(
    services.flatMap(([, service]) =>
      Object.entries(service.depends_on ?? {}).flatMap(([name, dependency]) =>
        dependency.condition === "service_completed_successfully" ? [name] : []
      )
    )
  );

const longRunning = (services: [string, Service][]): [string, Service][] =>
  services.filter(([name]) => !oneShotNames(services).has(name));

const oneShot = (services: [string, Service][]): [string, Service][] =>
  services.filter(([name]) => oneShotNames(services).has(name));

// The collector's image has no shell or HTTP client: its health check runs
// busybox's wget from a read-only volume a one-shot service fills.
const collectorProbe = (services: [string, Service][]) => {
  const collector = services.find(([name]) => name === "otel-collector")?.[1];
  const program = collector?.healthcheck?.test.at(1) ?? "";

  const volume = (collector?.volumes ?? [])
    .filter(isShortVolume)
    .map((mount) => mount.split(":"))
    .find(
      ([, target]) => target !== undefined && program.startsWith(`${target}/`)
    );

  const filler = services.find(
    ([name, service]) =>
      collector?.depends_on?.[name]?.condition ===
        "service_completed_successfully" &&
      (service.volumes ?? []).some(
        (mount) =>
          isShortVolume(mount) && mount.startsWith(`${volume?.at(0) ?? ""}:`)
      )
  );

  return {
    filler: filler?.[0],
    readOnly: volume?.at(2) === "ro",
    volume: volume?.at(0),
  };
};

const publicPorts = (service: Service): string[] =>
  (service.ports ?? []).filter((port) => !port.startsWith("127.0.0.1:"));

const healthTest = (service: Service): string | undefined =>
  service.healthcheck?.test.at(0);

describe("compose.yaml", () => {
  it("defines services", () => {
    expect(development.length).toBeGreaterThan(0);
  });

  it.each(development)("%s pins an exact image version", (_name, service) => {
    expect(service.image).toSatisfy(isPinned);
  });

  it.each(development)("%s mounts no image", (_name, service) => {
    expect(mountedImages(service)).toStrictEqual([]);
  });

  it.each(development)(
    "%s publishes ports on 127.0.0.1 only",
    (_name, service) => {
      expect(publicPorts(service)).toStrictEqual([]);
    }
  );

  it.each(longRunning(development))(
    "%s has a health check",
    (_name, service) => {
      expect(healthTest(service)).toMatch(/^CMD(?:-SHELL)?$/u);
    }
  );

  // Several runs of the server's tests share it, each holding up to about
  // 80 connections: past the limit, Postgres refuses the next.
  it("lets Postgres hold the connections of several test runs", () => {
    const postgres = development.find(([name]) => name === "postgres")?.[1];

    expect(postgres?.command).toStrictEqual([
      "postgres",
      "-c",
      "max_connections=400",
    ]);
  });

  it("probes the collector with a wget a one-shot service copies", () => {
    expect(collectorProbe(development)).toStrictEqual({
      filler: "collector-wget",
      readOnly: true,
      volume: "collector-wget",
    });
  });
});

describe("compose.production.yaml", () => {
  it("defines services", () => {
    expect(production.length).toBeGreaterThan(0);
  });

  // Peal's own images are built from this repository, and tagged with the
  // release (peal-infra) or `local`; Postgres's changes only with its image.
  it.each(production)(
    "%s builds its image here or pins it by digest",
    (name, service) => {
      const version =
        name === "postgres" ? "PEAL_POSTGRES_VERSION" : "PEAL_VERSION";

      expect(
        service.build === undefined
          ? isPinnedByDigest(service.image)
          : service.image === `peal-${name}:\${${version}:-local}`
      ).toBeTruthy();
    }
  );

  it.each(production)("%s mounts no image", (_name, service) => {
    expect(mountedImages(service)).toStrictEqual([]);
  });

  // So production runs the versions the development stack is used with.
  it.each(production.filter(([, service]) => service.build === undefined))(
    "%s runs the image development runs",
    (name, service) => {
      const image = development.find(([other]) => other === name)?.[1].image;

      expect(service.image.split("@").at(0)).toBe(image);
    }
  );

  it.each(production)(
    "%s publishes ports on 127.0.0.1 only",
    (_name, service) => {
      expect(publicPorts(service)).toStrictEqual([]);
    }
  );

  it.each(longRunning(production))(
    "%s has a health check",
    (_name, service) => {
      expect(healthTest(service)).toMatch(/^CMD(?:-SHELL)?$/u);
    }
  );

  it.each(longRunning(production))(
    "%s restarts unless stopped",
    (_name, service) => {
      expect(service.restart).toBe("unless-stopped");
    }
  );

  // It would otherwise run again each time the daemon starts, for nothing.
  it.each(oneShot(production))(
    "%s runs once, without a network",
    (_name, service) => {
      expect([service.restart, service.network_mode]).toStrictEqual([
        "no",
        "none",
      ]);
    }
  );

  it("has the one-shot services it names", () => {
    expect(oneShot(production).map(([name]) => name)).toStrictEqual([
      "collector-wget",
    ]);
  });

  it("probes the collector with a wget a one-shot service copies", () => {
    expect(collectorProbe(production)).toStrictEqual({
      filler: "collector-wget",
      readOnly: true,
      volume: "collector-wget",
    });
  });

  // The server waits up to 60 seconds for platform calls in flight.
  it("gives the server 75 seconds to stop", () => {
    const server = production.find(([name]) => name === "server")?.[1];

    expect(server?.stop_grace_period).toBe("75s");
  });

  // A superuser runs programs in Postgres's container, which holds the
  // backup bucket's key: the server signs in as a role of its own where one
  // is named (Peal's servers), and as the superuser only otherwise.
  it("signs the server in as its own role when one is named", () => {
    const server = production.find(([name]) => name === "server")?.[1];

    expect(server?.environment?.["DATABASE_URL"]).toMatch(
      /^postgres:\/\/\$\{PEAL_DATABASE_USER:-peal\}:\$\{PEAL_DATABASE_PASSWORD:-\$\{POSTGRES_PASSWORD:\?Set POSTGRES_PASSWORD\}\}@postgres:5432\/peal$/u
    );
  });

  // Cloudflare Access lets the staff alone through to Grafana, and they get
  // full access there, set again at each sign-in.
  it("signs the people Access lets through into Grafana as admins", () => {
    const grafana = production.find(([name]) => name === "grafana")?.[1];
    const environment = grafana?.environment ?? {};

    expect(environment["GF_AUTH_JWT_ROLE_ATTRIBUTE_PATH"]).toBe("'Admin'");
    expect(environment["GF_AUTH_JWT_AUTO_SIGN_UP"]).toBe("true");
    expect(environment["GF_AUTH_JWT_SKIP_ORG_ROLE_SYNC"]).toBeUndefined();
  });

  // Compose hands a container only the variables its service names, so a
  // setting left out here cannot be set at all, from an env file or
  // otherwise. The image sets NODE_ENV, the port mapping fixes PORT, and
  // Docker names each container in HOSTNAME.
  it("passes the server every setting the docs list for it", () => {
    const server = production.find(([name]) => name === "server")?.[1];
    const passed = Object.keys(server?.environment ?? {});

    expect(documentedServerSettings.length).toBeGreaterThan(0);

    expect(
      documentedServerSettings.filter(
        (name) =>
          !passed.includes(name) &&
          !["HOSTNAME", "NODE_ENV", "PORT"].includes(name)
      )
    ).toStrictEqual([]);
  });

  // Each memory setting falls back to PostgreSQL 18's own default, so a
  // server that sets none runs as Postgres would alone.
  it("gives Postgres its memory settings, with PostgreSQL's defaults", () => {
    const postgres = production.find(([name]) => name === "postgres")?.[1];

    const settings = (postgres?.command ?? []).filter(
      (_argument, index, command) => command[index - 1] === "-c"
    );

    expect(settings).toStrictEqual(
      expect.arrayContaining([
        fallback("shared_buffers", "SHARED_BUFFERS", "128MB"),
        fallback("effective_cache_size", "EFFECTIVE_CACHE_SIZE", "4GB"),
        fallback("maintenance_work_mem", "MAINTENANCE_WORK_MEM", "64MB"),
        fallback("random_page_cost", "RANDOM_PAGE_COST", "4"),
      ])
    );
  });

  // /dev/shm holds the dynamic shared memory of parallel queries and of a
  // parallel vacuum, which may take up to maintenance_work_mem: production
  // sets 512MB.
  it("gives Postgres more shared memory than a vacuum may take", () => {
    const postgres = production.find(([name]) => name === "postgres")?.[1];

    expect(postgres?.shm_size).toBe("1g");
  });

  it.each(production)(
    "%s runs on a read-only file system",
    (_name, service) => {
      expect(service.read_only).toBeTruthy();
    }
  );

  it.each(production)("%s gains no privileges", (_name, service) => {
    expect(service.security_opt).toContain("no-new-privileges:true");
  });
});

// Which services each service can reach: those it shares a network with.
// A service with no network of its own named would join Compose's default
// network, which every such service shares.
const networksOf = (service: Service): Set<string> =>
  service.network_mode === "none"
    ? new Set()
    : new Set(service.networks ?? ["default"]);

const neighbours = (services: [string, Service][]): Record<string, string[]> =>
  Object.fromEntries(
    services.flatMap(([name, service]) =>
      service.network_mode === "none"
        ? []
        : [
            [
              name,
              services
                .flatMap(([other, peer]) =>
                  other !== name &&
                  [...networksOf(peer)].some((network) =>
                    networksOf(service).has(network)
                  )
                    ? [other]
                    : []
                )
                .toSorted(),
            ],
          ]
    )
  );

// Loki, Tempo and Prometheus, which only the collector and Grafana reach.
const telemetryStore = new Set(["loki", "prometheus", "tempo"]);

describe("the production stack's networks", () => {
  // Loki takes logs without signing in, and Prometheus takes metrics
  // written to it: a container that reaches them could read every log and
  // trace, or forge metrics the alerts read. Only the collector writes to
  // them, only Grafana reads them, and only what needs Postgres reaches
  // it. The tunnel and the host reach the services on 127.0.0.1.
  it("lets each service reach only what it needs", () => {
    expect(neighbours(production)).toStrictEqual({
      blog: ["postgres"],
      docs: [],
      grafana: ["loki", "otel-collector", "prometheus", "tempo"],
      loki: ["grafana", "otel-collector", "prometheus", "tempo"],
      "otel-collector": ["grafana", "loki", "prometheus", "server", "tempo"],
      postgres: ["blog", "server"],
      prometheus: ["grafana", "loki", "otel-collector", "tempo"],
      server: ["otel-collector", "postgres", "web"],
      static: [],
      tempo: ["grafana", "loki", "otel-collector", "prometheus"],
      web: ["server"],
    });
  });

  it("gives Caddy, for self-hosters, the services it routes to", () => {
    expect(neighbours([...production, ...selfHost])["caddy"]).toStrictEqual([
      "docs",
      "server",
      "static",
      "web",
    ]);
  });

  // Loki, Tempo and Prometheus call nothing outside the stack.
  it("keeps the telemetry store's own network off the internet", () => {
    const networks = composeOf("compose.production.yaml").networks ?? {};

    const storeNetworks = production.flatMap(([name, service]) =>
      telemetryStore.has(name) ? (service.networks ?? []) : []
    );

    expect(storeNetworks.length).toBeGreaterThan(0);
    expect(
      storeNetworks.filter((network) => networks[network]?.internal !== true)
    ).toStrictEqual([]);
  });

  it("names every network a service joins", () => {
    const networks = Object.keys(
      composeOf("compose.production.yaml").networks ?? {}
    );

    expect(
      [...production, ...selfHost]
        .flatMap(([, service]) => service.networks ?? [])
        .filter((network) => !networks.includes(network))
    ).toStrictEqual([]);
  });
});

describe("compose.self-host.yaml", () => {
  it.each(selfHost)("%s pins its image by digest", (_name, service) => {
    expect(service.image).toSatisfy(isPinnedByDigest);
  });

  it.each(selfHost)("%s runs on a read-only file system", (_name, service) => {
    expect(service.read_only).toBeTruthy();
  });

  it.each(selfHost)("%s gains no privileges", (_name, service) => {
    expect(service.security_opt).toContain("no-new-privileges:true");
  });

  it.each(selfHost)("%s has a health check", (_name, service) => {
    expect(healthTest(service)).toMatch(/^CMD(?:-SHELL)?$/u);
  });

  it("opens only Caddy's HTTP and HTTPS ports to the world", () => {
    const opened = selfHost.flatMap(([name, service]) =>
      publicPorts(service).map((port) => `${name} ${port}`)
    );

    expect(opened).toStrictEqual([
      "caddy 80:80",
      "caddy 443:443",
      "caddy 443:443/udp",
    ]);
  });
});

const bunVersion = read("..", "..", "..", ".bun-version").trim();

// The Node version CI runs, which builds and runs the web app: every job
// sets it up through the workspace's setup action.
const nodeVersion =
  /node-version: (?<version>\S+)/u.exec(
    read("..", "..", "..", ".github", "actions", "setup", "action.yml")
  )?.groups?.["version"] ?? "";

const dockerfiles = [
  "server.Dockerfile",
  "web.Dockerfile",
  "static.Dockerfile",
  "docs.Dockerfile",
  "blog.Dockerfile",
  "postgres.Dockerfile",
];

const instructionsOf =
  (dockerfile: string) =>
  (keyword: string): string[] =>
    dockerfile
      .split("\n")
      .filter((line) => line.startsWith(`${keyword} `))
      .map((line) => line.slice(keyword.length + 1).trim());

const basesOf = (file: string): string[] =>
  instructionsOf(read("..", file))("FROM").map(
    (from) => from.split(" ").at(0) ?? ""
  );

describe.each(dockerfiles)("%s", (file) => {
  const dockerfile = read("..", file);
  const instructions = instructionsOf(dockerfile);
  const bases = basesOf(file);

  it("pins its base images by digest", () => {
    expect(bases.length).toBeGreaterThan(0);

    expect(bases.filter((base) => !isPinnedByDigest(base))).toStrictEqual([]);
  });

  // COPY --from=<image> brings files from an image, as FROM does.
  it("pins the images it copies from by digest", () => {
    const stages = new Set(
      instructions("FROM").flatMap((from) => {
        const alias = / AS (?<alias>\S+)$/iu.exec(from)?.groups?.["alias"];

        return alias === undefined ? [] : [alias];
      })
    );

    const copied = instructions("COPY").flatMap((copy) => {
      const source = /--from=(?<source>\S+)/u.exec(copy)?.groups?.["source"];

      return source === undefined || stages.has(source) ? [] : [source];
    });

    expect(copied.filter((image) => !isPinnedByDigest(image))).toStrictEqual(
      []
    );
  });

  it("pins its BuildKit frontend by digest", () => {
    const syntax = dockerfile.split("\n").at(0) ?? "";

    expect(syntax.replace("# syntax=", "")).toSatisfy(isPinnedByDigest);
  });

  it("uses the workspace's Bun and CI's Node", () => {
    const runtimes = bases.filter((base) => /^(?:oven\/bun|node):/u.test(base));

    expect(
      runtimes.filter(
        (base) =>
          !base.startsWith(`oven/bun:${bunVersion}-`) &&
          !base.startsWith(`node:${nodeVersion}-`)
      )
    ).toStrictEqual([]);
  });
});

// Bun refuses to install a lockfile whose patches it cannot read, whatever
// workspace it installs.
describe("the images that install the workspace", () => {
  it.each(dockerfiles)("%s copies the patches with the lockfile", (file) => {
    const copies = instructionsOf(read("..", file))("COPY");

    expect(copies.filter((copy) => copy === "patches patches")).toHaveLength(
      copies.filter((copy) => copy === "package.json bun.lock ./").length
    );
  });
});

// Postgres's entrypoint starts as root and drops to the postgres user itself.
describe.each(dockerfiles.filter((file) => file !== "postgres.Dockerfile"))(
  "%s",
  (file) => {
    it("runs as a user without privileges", () => {
      const user = instructionsOf(read("..", file))("USER").at(-1);

      expect(user).toBeDefined();

      expect(["root", "0"]).not.toContain(user);
    });
  }
);

describe("server.Dockerfile", () => {
  it("builds on the workspace's Bun version", () => {
    expect(
      basesOf("server.Dockerfile").filter(
        (base) => !base.startsWith(`oven/bun:${bunVersion}-`)
      )
    ).toStrictEqual([]);
  });

  // Bun runs the sources: a workspace package the server imports and the
  // image lacks would fail when it is first loaded, not at build.
  it("ships every workspace package the server depends on", () => {
    const { dependencies } = Schema.decodeUnknownSync(
      Schema.fromJsonString(
        Schema.Struct({
          dependencies: Schema.Record(Schema.String, Schema.String),
        })
      )
    )(read("..", "..", "peal-server", "package.json"));

    const folders = Object.entries(dependencies)
      .filter(([, version]) => version.startsWith("workspace:"))
      .map(([name]) => `packages/${name}`);

    const copies = instructionsOf(read("..", "server.Dockerfile"))("COPY");

    const times = (copy: string): number =>
      copies.filter((other) => other === copy).length;

    expect(folders).not.toHaveLength(0);

    expect(
      folders.filter(
        (folder) =>
          // In each stage: to install it, then to resolve it.
          times(`${folder}/package.json ${folder}/`) !== 2 ||
          times(`${folder}/src ${folder}/src`) !== 1 ||
          times(
            `--from=dependencies /app/${folder}/node_modules ${folder}/node_modules`
          ) !== 1
      )
    ).toStrictEqual([]);
  });

  it("ships ffprobe, which probes videos", () => {
    expect(
      instructionsOf(read("..", "server.Dockerfile"))("COPY").some((copy) =>
        copy.endsWith(" /usr/local/bin/ffprobe")
      )
    ).toBeTruthy();
  });
});

describe("web.Dockerfile", () => {
  // The standalone server leaves .next/static out.
  it("copies Next's static files beside the server", () => {
    expect(
      instructionsOf(read("..", "web.Dockerfile"))("COPY").some((copy) =>
        copy.endsWith(" packages/peal-web/.next/static")
      )
    ).toBeTruthy();
  });
});

describe("docs.Dockerfile", () => {
  // The rate limit counts readers by the address serve.ts puts in
  // X-Forwarded-For, from the header the edge sets.
  it("loads serve.ts, which sets the reader's address, before the docs", () => {
    expect(instructionsOf(read("..", "docs.Dockerfile"))("CMD")).toStrictEqual([
      '["node", "--import", "./packages/peal-docs/serve.ts", "packages/peal-docs/dist/server/entry.mjs"]',
    ]);
  });
});

const productionService = (name: string): Service | undefined =>
  production.find(([other]) => other === name)?.[1];

describe("the docs", () => {
  // A model would make Blume build a server, which nginx cannot serve.
  it("stay static files in the static image", () => {
    expect(
      instructionsOf(read("..", "static.Dockerfile"))("ARG").filter((arg) =>
        arg.startsWith("DOCS_ASSISTANT_MODEL")
      )
    ).toStrictEqual([]);
  });

  it("run as a server in a profile of their own", () => {
    const docs = productionService("docs");

    expect(docs?.environment).toHaveProperty("AUTH_IP_HEADERS");
    expect(docs?.ports).toHaveLength(1);
    expect(docs?.ports?.[0]).toMatch(
      /^127\.0\.0\.1:\$\{PEAL_DOCS_SERVER_PORT:-4323\}:4323$/u
    );
  });
});

// Credentials the blog reads when it starts, never when it is built.
const credential = /^(?:PG|S3_)|^EMDASH_ENCRYPTION_KEY$/u;

describe("the blog", () => {
  const blog = productionService("blog");

  it("runs in a profile of its own, on one loopback port", () => {
    expect(blog?.profiles).toStrictEqual(["blog"]);
    expect(blog?.ports).toHaveLength(1);
    expect(blog?.ports?.[0]).toMatch(
      /^127\.0\.0\.1:\$\{PEAL_BLOG_PORT:-4324\}:4324$/u
    );
  });

  it("checks EmDash's health", () => {
    expect(blog?.healthcheck?.test.join(" ")).toContain("/_emdash/api/health");
  });

  it("keeps editors' sessions in a volume", () => {
    expect(blog?.volumes).toContain(
      "blog-sessions:/app/packages/peal-blog/node_modules/.astro/sessions"
    );
  });

  it("reads its database and bucket only when it starts", () => {
    const instructions = instructionsOf(read("..", "blog.Dockerfile"));

    const built = [
      ...instructions("ARG"),
      ...instructions("ENV").flatMap((env) => env.split(/\s+/u)),
      ...Object.keys(blog?.build?.args ?? {}),
    ].map((entry) => entry.split("=").at(0) ?? "");

    expect(built.filter((name) => credential.test(name))).toStrictEqual([]);
    expect(blog?.environment).toHaveProperty("PGPASSWORD");
    expect(blog?.environment).toHaveProperty("S3_SECRET_ACCESS_KEY");
  });

  // A setting only the blog reads has no `:?`: Compose interpolates every
  // service, so one would refuse the whole stack with the profile off.
  it("requires no setting of its own", () => {
    const required = Object.entries(blog?.environment ?? {}).flatMap(
      ([name, value]) =>
        value !== null &&
        value.includes(":?") &&
        name !== "EMDASH_TRUSTED_PROXY_HEADERS"
          ? [name]
          : []
    );

    expect(required).toStrictEqual([]);
  });
});
