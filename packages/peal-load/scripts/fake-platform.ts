// A stand-in Mastodon instance and webhook receiver for load runs. The
// outbound guard sends what members name over HTTPS on the default port
// only, so it serves https on 443 (in a container: `serve.ts` publishes it
// on 127.0.0.1), and its counters over plain HTTP on 4011.
//
//   FAKE_CERT_DIR=… FAKE_LATENCY_MS=250 bun fake-platform.ts
import path from "node:path";

const latency = Number(process.env["FAKE_LATENCY_MS"] ?? "250");
const certDir = process.env["FAKE_CERT_DIR"] ?? import.meta.dirname;
const hostname = process.env["FAKE_HOST"] ?? "0.0.0.0";

interface Counters {
  firstHookAt: number | undefined;
  firstStatusAt: number | undefined;
  hookEvents: Map<string, number>;
  hooks: number;
  hooksPerSecond: Map<number, number>;
  inFlight: number;
  lastHookAt: number | undefined;
  lastStatusAt: number | undefined;
  mostInFlight: number;
  other: number;
  statuses: number;
  statusesPerSecond: Map<number, number>;
}

const fresh = (): Counters => ({
  firstHookAt: undefined,
  firstStatusAt: undefined,
  hookEvents: new Map(),
  hooks: 0,
  hooksPerSecond: new Map(),
  inFlight: 0,
  lastHookAt: undefined,
  lastStatusAt: undefined,
  mostInFlight: 0,
  other: 0,
  statuses: 0,
  statusesPerSecond: new Map(),
});

let counters = fresh();

const bump = (map: Map<number, number>, at: number) => {
  const second = Math.floor(at / 1000);

  map.set(second, (map.get(second) ?? 0) + 1);
};

const peak = (map: Map<number, number>) => Math.max(0, ...map.values());

const eventPattern = /"type"\s*:\s*"(?<type>[^"]+)"/u;

// A status posted: answered after the platform's latency, as Mastodon
// answers POST /api/v1/statuses.
const status = async (request: Request) => {
  counters.inFlight += 1;
  counters.mostInFlight = Math.max(counters.mostInFlight, counters.inFlight);
  await request.arrayBuffer();
  await Bun.sleep(latency);

  const now = Date.now();

  counters.statuses += 1;
  counters.firstStatusAt ??= now;
  counters.lastStatusAt = now;
  counters.inFlight -= 1;
  bump(counters.statusesPerSecond, now);

  const id = `${now}${counters.statuses}`;

  return Response.json({
    id,
    uri: `https://127.0.0.1/users/load/statuses/${id}`,
    url: `https://127.0.0.1/@load/${id}`,
  });
};

// A webhook delivery: counted by its event's type.
const hook = async (request: Request) => {
  const type =
    eventPattern.exec(await request.text())?.groups?.["type"] ?? "unknown";

  const now = Date.now();

  counters.hooks += 1;
  counters.firstHookAt ??= now;
  counters.lastHookAt = now;
  bump(counters.hooksPerSecond, now);
  counters.hookEvents.set(type, (counters.hookEvents.get(type) ?? 0) + 1);

  return new Response(null, { status: 204 });
};

Bun.serve({
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/api/v1/statuses") {
      return await status(request);
    }

    if (request.method === "POST" && pathname === "/hooks") {
      return await hook(request);
    }

    counters.other += 1;

    return Response.json({ error: "Record not found" }, { status: 404 });
  },
  hostname,
  port: 443,
  tls: {
    cert: Bun.file(path.join(certDir, "fake.crt")),
    key: Bun.file(path.join(certDir, "fake.key")),
  },
});

Bun.serve({
  fetch(request) {
    if (request.method === "POST") {
      counters = { ...fresh(), inFlight: counters.inFlight };

      return new Response(null, { status: 204 });
    }

    return Response.json({
      firstHookAt: counters.firstHookAt,
      firstStatusAt: counters.firstStatusAt,
      hookEvents: Object.fromEntries(counters.hookEvents),
      hooks: counters.hooks,
      hooksPeakPerSecond: peak(counters.hooksPerSecond),
      inFlight: counters.inFlight,
      lastHookAt: counters.lastHookAt,
      lastStatusAt: counters.lastStatusAt,
      latency,
      mostInFlight: counters.mostInFlight,
      other: counters.other,
      statuses: counters.statuses,
      statusesPeakPerSecond: peak(counters.statusesPerSecond),
    });
  },
  hostname,
  port: 4011,
});

console.log(`Fake platform on :443, counters on :4011, ${latency} ms a status`);
