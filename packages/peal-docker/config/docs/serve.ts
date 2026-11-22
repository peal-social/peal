// Loaded before Blume's Node build in the docs image (docs.Dockerfile, with
// node --import), to put two settings of the stack's where Blume reads
// them. Node runs this file as it is, stripping its types.
//
// The assistant's rate limit counts each reader by the first address of
// X-Forwarded-For, for requests to the docs' host name (allowedDomains in
// blume.config.ts). The edge in front sets the reader's address in one of
// the headers AUTH_IP_HEADERS names, as the server reads it:
// cf-connecting-ip behind Cloudflare, which a reader cannot set, while
// Cloudflare only appends to any X-Forwarded-For a reader sends;
// x-forwarded-for behind Caddy, which replaces it. Node announces each
// request on the http.server.request.start channel before the server's
// listeners see it: its X-Forwarded-For then becomes that address alone,
// an IPv6 one cut to its /64 (`readerAddressOf`), as one subscriber holds
// a whole /64 and could ask from a new address each time; or it goes when
// no such header came, or not an address, so the count falls back to the
// connection's address.
//
// The Turnstile secret is DOCS_TURNSTILE_SECRET_KEY in the stack's
// environment, apart from the server's TURNSTILE_SECRET_KEY (which, without
// TURNSTILE_SITE_KEY, stops the server), and Blume reads it as
// TURNSTILE_SECRET_KEY.
import { subscribe } from "node:diagnostics_channel";
import type { IncomingHttpHeaders } from "node:http";
import { IncomingMessage } from "node:http";
import { isIPv4, isIPv6 } from "node:net";
import process from "node:process";

const docsSecret = process.env["DOCS_TURNSTILE_SECRET_KEY"]?.trim();

if (docsSecret !== undefined && docsSecret !== "") {
  process.env["TURNSTILE_SECRET_KEY"] = docsSecret;
}

const addressHeaders = (process.env["AUTH_IP_HEADERS"] ?? "")
  .split(",")
  .map((name) => name.trim().toLowerCase())
  .filter((name) => name !== "");

// An IPv6 address's eight groups, from any spelling of it: `::` for a run
// of zeros, an IPv4 address in its last 32 bits.
const byte = 256;

const hexOfDotted = (dotted: string): string => {
  const [a = 0, b = 0, c = 0, d = 0] = dotted.split(".").map(Number);

  return `${(a * byte + b).toString(16)}:${(c * byte + d).toString(16)}`;
};

const groupsIn = (text: string): number[] =>
  text === "" ? [] : text.split(":").map((group) => Number.parseInt(group, 16));

const groupsOf = (address: string): number[] => {
  const dotted = /(?<v4>\d+\.\d+\.\d+\.\d+)$/u.exec(address)?.groups?.["v4"];

  const hex =
    dotted === undefined
      ? address
      : `${address.slice(0, -dotted.length)}${hexOfDotted(dotted)}`;

  const [head = "", tail] = hex.split("::");
  const before = groupsIn(head);
  const after = tail === undefined ? [] : groupsIn(tail);

  return [
    ...before,
    ...Array.from({ length: 8 - before.length - after.length }, () => 0),
    ...after,
  ];
};

/**
 * Who the rate limit counts, from the address the edge gives: an IPv4
 * address as it is (an IPv4-mapped IPv6 one too), and an IPv6 address as
 * its /64, the network one subscriber holds whole and may take any address
 * of, written as that network's first address. Anything else is none.
 */
export const readerAddressOf = (address: string): string | undefined => {
  const bare = address
    .trim()
    .replace(/^\[(?<inner>[^\]]*)\](?::\d+)?$/u, "$<inner>")
    .replace(/%.*$/u, "");

  if (isIPv4(bare)) {
    return bare;
  }

  if (!isIPv6(bare)) {
    return undefined;
  }

  const groups = groupsOf(bare.toLowerCase());

  // ::ffff:0:0/96 carries an IPv4 address.
  if (
    groups.slice(0, 5).every((group) => group === 0) &&
    groups[5] === 0xff_ff
  ) {
    return groups
      .slice(6)
      .flatMap((group) => [Math.floor(group / byte), group % byte])
      .join(".");
  }

  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(":")}::`;
};

// The first value of the first header named that the request carries.
const readerAddress = (headers: IncomingHttpHeaders): string | undefined =>
  addressHeaders
    .map((name) => {
      const value = headers[name];

      return (Array.isArray(value) ? value[0] : value)?.split(",")[0]?.trim();
    })
    .find((address) => address !== undefined && address !== "");

const forwardReader = (request: IncomingMessage): void => {
  const given = readerAddress(request.headers);
  const address = given === undefined ? undefined : readerAddressOf(given);

  if (address === undefined) {
    delete request.headers["x-forwarded-for"];
  } else {
    request.headers["x-forwarded-for"] = address;
  }
};

if (addressHeaders.length > 0) {
  subscribe("http.server.request.start", (message) => {
    if (
      message instanceof Object &&
      "request" in message &&
      message.request instanceof IncomingMessage
    ) {
      forwardReader(message.request);
    }
  });
}
