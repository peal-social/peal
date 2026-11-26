// Serves a load run: the fake platform in a container on 127.0.0.1:443
// (the outbound guard reaches what members name only there, and binding
// 443 often needs privileges Docker already has), then SERVERS Peal servers
// (1 by default) on 3100 and the ports after it, each its own cluster
// runner, as several containers would be: one runs the jobs, every one
// answers the API. A signal stops them all, and so does any of them
// exiting.
//
//   SERVERS=3 bun scripts/serve.ts
import { existsSync } from "node:fs";
import path from "node:path";

import {
  databaseUrl,
  fakeStatsUrl,
  firstPort,
  packageRoot,
  runDir,
  serverRoot,
  tokenKeys,
} from "./run.ts";

const servers = Number(process.env["SERVERS"] ?? "1");
const latency = process.env["FAKE_LATENCY_MS"] ?? "250";
const fakeImage = "oven/bun:1.4.5";
const fakeName = "peal-load-fake";

const certificate = path.join(runDir, "fake.crt");

if (!existsSync(certificate)) {
  const made = Bun.spawnSync([
    "openssl",
    "req",
    "-x509",
    "-newkey",
    "ec",
    "-pkeyopt",
    "ec_paramgen_curve:prime256v1",
    "-nodes",
    "-keyout",
    path.join(runDir, "fake.key"),
    "-out",
    certificate,
    "-days",
    "30",
    "-subj",
    "/CN=127.0.0.1",
    "-addext",
    "subjectAltName=IP:127.0.0.1",
  ]);

  if (made.exitCode !== 0) {
    throw new Error(`openssl failed: ${made.stderr.toString()}`);
  }
}

Bun.spawnSync(["docker", "rm", "-f", fakeName], {
  stdio: ["ignore", "ignore", "ignore"],
});

const fake = Bun.spawnSync([
  "docker",
  "run",
  "-d",
  "--rm",
  "--name",
  fakeName,
  "-e",
  `FAKE_LATENCY_MS=${latency}`,
  "-e",
  "FAKE_CERT_DIR=/certs",
  "-p",
  "127.0.0.1:443:443",
  "-p",
  "127.0.0.1:4011:4011",
  "-v",
  `${path.join(packageRoot, "scripts")}:/app:ro`,
  "-v",
  `${runDir}:/certs:ro`,
  fakeImage,
  "bun",
  "/app/fake-platform.ts",
]);

if (fake.exitCode !== 0) {
  throw new Error(`docker run failed: ${fake.stderr.toString()}`);
}

const keys = await tokenKeys();

const children = Array.from({ length: servers }, (_, index) => {
  const port = firstPort + index;

  return Bun.spawn(["bun", "src/main.ts"], {
    cwd: serverRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      HOSTNAME: `peal-load-${port}`,
      NODE_EXTRA_CA_CERTS: certificate,
      // Each request counts as it would; the limit itself would stop k6.
      PEAL_API_REQUESTS_PER_MINUTE: "100000000",
      PEAL_OUTBOUND_ALLOWED_HOSTS: "127.0.0.1",
      PEAL_S3_KEY_PREFIX: "load/",
      PEAL_TOKEN_KEYS: keys,
      PORT: String(port),
    },
    stdio: [
      "ignore",
      Bun.file(path.join(runDir, `server-${port}.log`)),
      "inherit",
    ],
  });
});

const stop = () => {
  for (const child of children) {
    child.kill("SIGINT");
  }

  Bun.spawnSync(["docker", "rm", "-f", fakeName], {
    stdio: ["ignore", "ignore", "ignore"],
  });
};

process.on("SIGINT", stop);

process.on("SIGTERM", stop);

// Whether the server on `port` answers its health check, asked once a
// second for two minutes.
const healthy = async (port: number, attempt = 0): Promise<void> => {
  const answer = await fetch(`http://127.0.0.1:${port}/api/health`).catch(
    () => null
  );

  if (answer?.status === 204) {
    return;
  }

  if (attempt >= 120) {
    throw new Error(`The server on ${port} never answered its health check`);
  }

  await Bun.sleep(1000);

  await healthy(port, attempt + 1);
};

// A server that never comes up stops the others and the fake too: left
// running, their runners would hold the shards of the next run.
try {
  await Promise.all(
    children.map(async (_, index) => {
      await healthy(firstPort + index);
    })
  );

  await fetch(`${fakeStatsUrl}/stats`);
} catch (error) {
  stop();
  await Promise.all(children.map(async (child) => await child.exited));

  throw error;
}

console.log(
  `Ready: ${servers} server(s) from :${firstPort}, logs in .local/server-<port>.log`
);

await Promise.race(children.map(async (child) => await child.exited));

stop();

await Promise.all(children.map(async (child) => await child.exited));
