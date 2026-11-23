import { describe, expect, it } from "@effect/vitest";

import {
  relayedAddressOf,
  relayedFileOf,
  relayedSourceOf,
  relayedTypeOf,
  upstreamAddressOf,
} from "#studio/asset-relay.ts";

const origin = "https://app.example.com";

describe("the Studio editor's relay", () => {
  it("serves the SDK's files from their one host", () => {
    expect([
      relayedFileOf([
        "fonts.gstatic.com",
        "s",
        "roboto",
        "v50",
        "KFOm-Me5.ttf",
      ]),
      relayedFileOf(["js.shotstack.io", "canvas", "hb.wasm"]),
      relayedFileOf([
        "unpkg.com",
        "@resvg",
        "resvg-wasm@2.6.2",
        "index_bg.wasm",
      ]),
      relayedFileOf([
        "cdn.jsdelivr.net",
        "gh",
        "googlefonts",
        "noto-emoji@main",
        "svg",
        "emoji_u1f600.svg",
      ]),
      relayedFileOf([
        "templates.shotstack.io",
        "basic",
        "asset",
        "font",
        "Roboto.ttf",
      ]),
    ]).toStrictEqual([
      {
        maxAge: 31_536_000,
        url: "https://fonts.gstatic.com/s/roboto/v50/KFOm-Me5.ttf",
      },
      { maxAge: 86_400, url: "https://js.shotstack.io/canvas/hb.wasm" },
      {
        maxAge: 31_536_000,
        url: "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm",
      },
      {
        maxAge: 86_400,
        url: "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg/emoji_u1f600.svg",
      },
      {
        maxAge: 86_400,
        url: "https://templates.shotstack.io/basic/asset/font/Roboto.ttf",
      },
    ]);
  });

  it("serves nothing else", () => {
    expect(
      [
        ["example.com", "font.ttf"],
        ["fonts.gstatic.com", "s", "roboto", "v50", "..", "secret.ttf"],
        ["fonts.gstatic.com", "css2"],
        ["unpkg.com", "@resvg", "resvg-wasm@latest", "index_bg.wasm"],
        ["js.shotstack.io", "studio.js"],
        ["cdn.jsdelivr.net", "npm", "anything.js"],
        [],
      ].map(relayedFileOf)
    ).toStrictEqual([null, null, null, null, null, null, null]);
  });

  it("serves each file as its kind", () => {
    expect(
      ["a.wasm", "a.svg", "a.woff2", "a.woff", "a.otf", "a.ttf"].map(
        relayedTypeOf
      )
    ).toStrictEqual([
      "application/wasm",
      "image/svg+xml",
      "font/woff2",
      "font/woff",
      "font/otf",
      "font/ttf",
    ]);
  });

  it("sends a font's CSS source through the relay, its quotes kept", () => {
    expect([
      relayedSourceOf(
        'url("https://fonts.gstatic.com/s/geist/v4/a.ttf")',
        origin
      ),
      relayedSourceOf(
        "url(https://fonts.gstatic.com/s/geist/v4/a.ttf)",
        origin
      ),
      relayedSourceOf("url(blob:https://app.example.com/1)", origin),
    ]).toStrictEqual([
      `url("${origin}/studio-assets/fonts.gstatic.com/s/geist/v4/a.ttf")`,
      `url(${origin}/studio-assets/fonts.gstatic.com/s/geist/v4/a.ttf)`,
      "url(blob:https://app.example.com/1)",
    ]);
  });

  it("sends a relayed host's address through the relay and back", () => {
    const font = "https://fonts.gstatic.com/s/inter/v20/abc.ttf";
    const relayed = relayedAddressOf(font, origin);

    expect([
      relayed,
      upstreamAddressOf(relayed, origin),
      relayedAddressOf("https://cdn.example.com/a.png", origin),
      upstreamAddressOf("https://cdn.example.com/a.png", origin),
    ]).toStrictEqual([
      `${origin}/studio-assets/fonts.gstatic.com/s/inter/v20/abc.ttf`,
      font,
      "https://cdn.example.com/a.png",
      "https://cdn.example.com/a.png",
    ]);
  });
});
