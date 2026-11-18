// The server listens on PORT, or on the image's port when PORT is unset,
// empty or not a port: never on a random one.
import { describe, expect, it } from "vitest";

import { defaultPort, portOf } from "../server/port.ts";

describe("the server's port", () => {
  it.each([
    ["4324", 4324],
    ["8080", 8080],
    [" 3000 ", 3000],
    ["65535", 65_535],
    ["1", 1],
  ])("is %j as written", (value, port) => {
    expect(portOf(value)).toBe(port);
  });

  it.each([
    undefined,
    "",
    " ",
    "0",
    "65536",
    "-1",
    "80.5",
    "1e3",
    "0x50",
    "port",
    "080",
  ])("is the image's for %j", (value) => {
    expect(portOf(value)).toBe(defaultPort);
  });
});
