import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  DiscordOptions,
  maxDiscordThreadNameLength,
} from "#publishing/domain/discord-options.ts";
import { describeOptionsOn } from "#publishing/domain/target-options.ts";
import { TelegramOptions } from "#publishing/domain/telegram-options.ts";

describe(DiscordOptions, () => {
  it("needs nothing", () => {
    expect(new DiscordOptions({}).problems()).toStrictEqual([]);
  });

  it("takes a thread name of one line, of 100 characters at most", () => {
    expect(
      new DiscordOptions({ threadName: "a".repeat(100) }).problems()
    ).toStrictEqual([]);
    expect(
      new DiscordOptions({ threadName: "a".repeat(101) }).problems()
    ).toStrictEqual([
      {
        _tag: "tooLong",
        field: "threadName",
        length: 101,
        maximum: maxDiscordThreadNameLength,
      },
    ]);
    expect(
      new DiscordOptions({ threadName: "Two\nlines" }).problems()
    ).toStrictEqual([{ _tag: "invalid", field: "threadName" }]);
    expect(new DiscordOptions({ threadName: "  " }).problems()).toStrictEqual([
      { _tag: "invalid", field: "threadName" },
    ]);
  });

  it("describes mentions as off when left out", () => {
    expect(describeOptionsOn("discord").map(({ name }) => name)).toStrictEqual([
      "mentions",
      "silent",
      "suppressEmbeds",
      "threadName",
    ]);
    expect(DiscordOptions.notes.mentions.ifLeftOut).toBeFalsy();
  });
});

describe(TelegramOptions, () => {
  it("needs nothing, and shows a link's preview when left out", () => {
    expect(new TelegramOptions({}).problems()).toStrictEqual([]);
    expect(
      Schema.decodeUnknownSync(TelegramOptions)({
        linkPreview: false,
        platform: "telegram",
        silent: true,
      })
    ).toStrictEqual(new TelegramOptions({ linkPreview: false, silent: true }));
    expect(describeOptionsOn("telegram").map(({ name }) => name)).toStrictEqual(
      ["linkPreview", "silent"]
    );
    expect(TelegramOptions.notes.linkPreview.ifLeftOut).toBeTruthy();
  });
});
