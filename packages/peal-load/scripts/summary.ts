// A k6 run's requests, window by window, from its CSV (`k6 run --out
// csv=…`): how many it served a second, its median, p95 and p99, and the
// server errors and timeouts, so a ramp shows where it stopped keeping up.
//
//   bun scripts/summary.ts .local/api.csv [window seconds]
import { readFileSync } from "node:fs";

const [file = "", windowArgument = "30"] = process.argv.slice(2);
const windowSeconds = Number(windowArgument);

const lines = readFileSync(file, "utf-8").trim().split("\n");
const header = (lines[0] ?? "").split(",");
const column = (name: string) => header.indexOf(name);

const [metric, timestamp, value, status] = [
  column("metric_name"),
  column("timestamp"),
  column("metric_value"),
  column("status"),
];

interface Request {
  readonly at: number;
  readonly duration: number;
  readonly status: string;
}

const requests: Request[] = lines
  .slice(1)
  .map((line) => line.split(","))
  .filter((cells) => cells[metric] === "http_req_duration")
  .map((cells) => ({
    at: Number(cells[timestamp]),
    duration: Number(cells[value]),
    status: cells[status] ?? "",
  }));

// A run holds a million requests and more: no spread into Math.min, which
// takes them as arguments, and each window grows in place.
let start = Number.POSITIVE_INFINITY;

for (const request of requests) {
  start = Math.min(start, request.at);
}

const windows = new Map<number, Request[]>();

for (const request of requests) {
  const index = Math.floor((request.at - start) / windowSeconds);
  const inWindow = windows.get(index);

  if (inWindow === undefined) {
    windows.set(index, [request]);
  } else {
    inWindow.push(request);
  }
}

const at = (sorted: readonly number[], share: number) =>
  Math.round(
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0
  );

console.log("from    served/s   median     p95     p99   5xx/timeouts");

for (const [index, inWindow] of [...windows].toSorted(([a], [b]) => a - b)) {
  const sorted = inWindow
    .map((request) => request.duration)
    .toSorted((a, b) => a - b);

  const failed = inWindow.filter(
    (request) => request.status === "0" || request.status.startsWith("5")
  ).length;

  console.log(
    [
      `${index * windowSeconds}s`.padEnd(6),
      String(Math.round(inWindow.length / windowSeconds)).padStart(10),
      `${at(sorted, 0.5)}ms`.padStart(9),
      `${at(sorted, 0.95)}ms`.padStart(8),
      `${at(sorted, 0.99)}ms`.padStart(8),
      String(failed).padStart(15),
    ].join(" ")
  );
}
