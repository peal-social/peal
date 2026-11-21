import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import * as Contract from "peal-contract";

import { slotView } from "#publishing/api/queue-view.ts";
import { slotFrom } from "#publishing/api/queues.ts";
import {
  maxChannelSetNameLength,
  maxChannelSetsPerWorkspace,
  maxChannelsPerSet,
} from "#publishing/domain/channel-set.ts";
import {
  defaultQueuePreview,
  maxChannelsPerQueue,
  maxQueueNameLength,
  maxQueuePreview,
  maxQueuesPerWorkspace,
  maxSlotsPerQueue,
  queueHorizonDays,
} from "#publishing/domain/queue.ts";
import {
  maxSignatureLength,
  maxSignatureNameLength,
  maxSignaturesPerWorkspace,
  signed,
} from "#publishing/domain/signature.ts";
import {
  maxTagNameLength,
  maxTagsPerPost,
  maxTagsPerWorkspace,
  TagColourSchema,
} from "#publishing/domain/tag.ts";
import { WeekdaySchema } from "#shared/domain/wall-clock.ts";

// The contract copies the limits of what a workspace saves, and how a
// signature goes under a text, for clients that check or insert before
// they send: both must say the same.

describe("the contract's copy of tags, signatures and channel sets", () => {
  it("has the domain's limits", () => {
    expect({
      maxChannelSetNameLength: Contract.maxChannelSetNameLength,
      maxChannelSetsPerWorkspace: Contract.maxChannelSetsPerWorkspace,
      maxChannelsPerSet: Contract.maxChannelsPerSet,
      maxSignatureLength: Contract.maxSignatureLength,
      maxSignatureNameLength: Contract.maxSignatureNameLength,
      maxSignaturesPerWorkspace: Contract.maxSignaturesPerWorkspace,
      maxTagNameLength: Contract.maxTagNameLength,
      maxTagsPerPost: Contract.maxTagsPerPost,
      maxTagsPerWorkspace: Contract.maxTagsPerWorkspace,
    }).toStrictEqual({
      maxChannelSetNameLength,
      maxChannelSetsPerWorkspace,
      maxChannelsPerSet,
      maxSignatureLength,
      maxSignatureNameLength,
      maxSignaturesPerWorkspace,
      maxTagNameLength,
      maxTagsPerPost,
      maxTagsPerWorkspace,
    });
  });

  it("has the domain's palette, in its order", () => {
    expect(Contract.TagColourSchema.literals).toStrictEqual(
      TagColourSchema.literals
    );
  });

  it.each([
    ["Hello", "— The studio"],
    ["Hello\n\n  ", "— The studio"],
    ["", "— The studio"],
    ["  \n", "— The studio"],
    ["Hello\n\n— The studio", "— The studio"],
    ["Hello\n\n— The studio\n", "— The studio"],
    ["Hello\n\nCafé", "Café"],
    ["— The studio\n\nHello", "— The studio"],
  ])("signs %j with %j as the domain does", (text, signature) => {
    expect(Contract.signedText(text, signature)).toBe(signed(text, signature));
  });
});

describe("the contract's copy of queues", () => {
  it("has the domain's limits", () => {
    expect({
      defaultQueuePreview: Contract.defaultQueuePreview,
      maxChannelsPerQueue: Contract.maxChannelsPerQueue,
      maxQueueNameLength: Contract.maxQueueNameLength,
      maxQueuePreview: Contract.maxQueuePreview,
      maxQueuesPerWorkspace: Contract.maxQueuesPerWorkspace,
      maxSlotsPerQueue: Contract.maxSlotsPerQueue,
      queueHorizonDays: Contract.queueHorizonDays,
    }).toStrictEqual({
      defaultQueuePreview,
      maxChannelsPerQueue,
      maxQueueNameLength,
      maxQueuePreview,
      maxQueuesPerWorkspace,
      maxSlotsPerQueue,
      queueHorizonDays,
    });
  });

  it("names the days of the week as the kernel does, in its order", () => {
    expect(Contract.WeekdaySchema.literals).toStrictEqual(
      WeekdaySchema.literals
    );
  });

  it("reads and writes a slot's time as the domain holds it", () => {
    const slot = { day: "sunday", time: "02:05" } as const;

    expect(slotFrom(slot)).toStrictEqual({
      day: "sunday",
      time: { hour: 2, minute: 5 },
    });
    expect(slotView(slotFrom(slot))).toStrictEqual(slot);
  });
});

// A name is shown beside other text, to other members: a mark that
// overrides, embeds or isolates its direction could reverse or hide what
// follows it (Unicode's "Trojan Source" marks), so the API takes none, for
// every client and the MCP tools alike. The marks a right-to-left name may
// need, and the joiner of an emoji, it takes. The domain does not refuse
// them, so names saved before still read.
describe("a name a member writes", () => {
  const names = [
    ["a tag", Contract.TagNameSchema],
    ["a signature", Contract.SignatureDetailsSchema.fields.name],
    ["a channel set", Contract.ChannelSetDetailsSchema.fields.name],
    ["a queue", Contract.QueueDetailsSchema.fields.name],
    ["a channel's label", Contract.ChannelUpdateSchema.fields.label],
  ] as const;

  it.each(names)("refuses a direction override in %s", (_, schema) => {
    for (const name of ["Sale \u202Efdp.exe", "a\u2066b\u2069", "x\u202Ay"]) {
      expect(Schema.is(schema)(name)).toBeFalsy();
    }
  });

  it.each(names)("takes right-to-left marks and emoji in %s", (_, schema) => {
    for (const name of ["שלום\u200F", "👨\u200D👩\u200D👧 Family"]) {
      expect(Schema.is(schema)(name)).toBeTruthy();
    }
  });
});
