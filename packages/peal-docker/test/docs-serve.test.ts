// The docs assistant's rate limit counts readers by the address serve.ts
// puts in X-Forwarded-For. One IPv6 network (a /64) is one reader there,
// as anyone holding it can pick any address in it for every question.
import { once } from "node:events";
import { createServer } from "node:http";

import { describe, expect, it } from "vitest";

import { readerAddressOf } from "../config/docs/serve.ts";

describe(readerAddressOf, () => {
  it.each([
    ["203.0.113.7", "203.0.113.7"],
    ["2001:db8:1:2::1", "2001:db8:1:2::"],
    ["2001:db8:1:2:aaaa:bbbb:cccc:dddd", "2001:db8:1:2::"],
    ["2001:0DB8:0001:0002:0:0:0:ffff", "2001:db8:1:2::"],
    ["2001:db8::", "2001:db8:0:0::"],
    ["::1", "0:0:0:0::"],
    ["fe80::1%eth0", "fe80:0:0:0::"],
    ["[2001:db8:1:2::5]", "2001:db8:1:2::"],
    ["[2001:db8:1:2::5]:443", "2001:db8:1:2::"],
    ["64:ff9b::198.51.100.4", "64:ff9b:0:0::"],
  ])("counts %s as %s", (address, reader) => {
    expect(readerAddressOf(address)).toBe(reader);
  });

  it("counts every address of one /64 as one reader, and the next /64 apart", () => {
    expect(readerAddressOf("2001:db8:1:2:1::")).toBe(
      readerAddressOf("2001:db8:1:2:ffff:ffff:ffff:ffff")
    );
    expect(readerAddressOf("2001:db8:1:3::1")).not.toBe(
      readerAddressOf("2001:db8:1:2::1")
    );
  });

  it.each([
    ["::ffff:198.51.100.4", "198.51.100.4"],
    ["::FFFF:198.51.100.4", "198.51.100.4"],
    ["::ffff:c633:6404", "198.51.100.4"],
    ["0:0:0:0:0:ffff:198.51.100.4", "198.51.100.4"],
  ])("reads the IPv4-mapped %s as %s", (address, reader) => {
    expect(readerAddressOf(address)).toBe(reader);
  });

  it.each(["", "unknown", "300.1.2.3", "2001:db8::1::2", "1:2:3:4:5:6:7:8:9"])(
    "takes %j for no address",
    (address) => {
      expect(readerAddressOf(address)).toBeUndefined();
    }
  );
});

describe("the docs' Node server", () => {
  it("keeps every answer out of search, until peal.social is indexable", async () => {
    const server = createServer((_, response) => {
      response.end("docs");
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    try {
      const address = server.address();
      const port = address instanceof Object ? address.port : 0;

      const response = await fetch(`http://127.0.0.1:${port}/`);

      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
