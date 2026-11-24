import { once } from "node:events";
import { connect } from "node:net";
import { setImmediate } from "node:timers/promises";

import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { fakeDevTo } from "#test/channels/fakes/fake-devto.ts";
import { fakeHashnode } from "#test/channels/fakes/fake-hashnode.ts";
import { fakeHttpServer } from "#test/channels/fakes/fake-http-server.ts";
import { fakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import {
  empty,
  platformServer,
} from "#test/publishing/fakes/platform-server.ts";

// A client that sends a request's head and part of its body, then goes
// away, as a fetch aborted by its timeout does: the fake's read of the
// body fails.
const cutOff = (address: string) =>
  Effect.promise(async () => {
    const socket = connect(Number(new URL(address).port), "127.0.0.1");

    await once(socket, "connect");
    socket.write(
      "POST /cut HTTP/1.1\r\nhost: 127.0.0.1\r\ncontent-length: 1000\r\nexpect: 100-continue\r\n\r\n"
    );
    // Node answers 100 Continue as it hands the request to the fake, which
    // then waits for the body.
    await once(socket, "data");
    socket.write("part");
    socket.destroy();
    await once(socket, "close");
  });

// The status of a request the fake answers.
const statusOf = (url: string) =>
  Effect.promise(async () => {
    const response = await fetch(url);

    await response.arrayBuffer();

    return response.status;
  });

/**
 * Runs `effect`, then lets the event loop turn, and gives what it gave
 * with how many rejections no one handled meanwhile. It listens beside
 * the runner's own listener, which still reports each one.
 */
const withRejections = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* observing() {
    let rejections = 0;

    const listener = () => {
      rejections += 1;
    };

    process.on("unhandledRejection", listener);

    return yield* effect.pipe(
      Effect.tap(() =>
        Effect.promise(async () => {
          await setImmediate();
          await setImmediate();
        })
      ),
      Effect.map((value) => ({ rejections, value })),
      Effect.ensuring(
        Effect.sync(() => process.off("unhandledRejection", listener))
      )
    );
  });

// Each fake, by the address its server answers at.
const fakes = [
  [
    "the fake HTTP server",
    fakeHttpServer(() => ({ status: 204 })).pipe(Effect.map(({ url }) => url)),
  ],
  [
    "the fake platform",
    platformServer(() => empty(204)).pipe(Effect.map(({ url }) => url)),
  ],
  ["the fake DEV", fakeDevTo().pipe(Effect.map(({ api }) => api))],
  ["the fake Hashnode", fakeHashnode().pipe(Effect.map(({ api }) => api))],
  [
    "the fake WordPress site",
    fakeWordPress().pipe(Effect.map(({ home }) => home)),
  ],
] as const;

describe("a request whose client went away before its body", () => {
  for (const [name, started] of fakes) {
    it.effect(`leaves nothing unhandled behind ${name}, which answers on`, () =>
      Effect.gen(function* cutOffRequest() {
        const address = yield* started;

        const { rejections, value: status } = yield* withRejections(
          cutOff(address).pipe(
            Effect.andThen(statusOf(new URL("/next", address).href))
          )
        );

        assert.strictEqual(rejections, 0);
        assert.isAtLeast(status, 200);
      }).pipe(Effect.scoped)
    );
  }
});

describe("a fake whose own code fails", () => {
  it.effect(
    "answers 500, and leaves nothing unhandled, when its handler throws",
    () =>
      Effect.gen(function* throwing() {
        const local = yield* fakeHttpServer(() => {
          throw new Error("A synthetic handler's bug");
        });

        const platform = yield* platformServer(async () => {
          await Promise.resolve();

          throw new Error("A synthetic handler's bug");
        });

        const { rejections, value } = yield* withRejections(
          Effect.all([
            statusOf(`${local.url}/answer`),
            statusOf(`${platform.url}/answer`),
          ])
        );

        assert.strictEqual(rejections, 0);
        assert.deepStrictEqual(value, [500, 500]);
      }).pipe(Effect.scoped)
  );

  it.effect(
    "answers 500, and leaves nothing unhandled, for a malformed escape",
    () =>
      Effect.gen(function* malformed() {
        const local = yield* fakeHttpServer(() => ({ status: 204 }));
        const platform = yield* platformServer(() => empty(204));

        const { rejections, value } = yield* withRejections(
          Effect.all([
            statusOf(`${local.url}/%E0%A4%A`),
            statusOf(`${platform.url}/%E0%A4%A`),
          ])
        );

        assert.strictEqual(rejections, 0);
        assert.deepStrictEqual(value, [500, 500]);
      }).pipe(Effect.scoped)
  );
});

it.effect("the fake HTTP server reads a body as text, its BOM dropped", () =>
  Effect.gen(function* withMark() {
    const local = yield* fakeHttpServer(() => ({ status: 204 }));

    yield* Effect.promise(
      async () =>
        await fetch(`${local.url}/marked`, {
          body: "﻿{}",
          method: "POST",
        })
    );

    assert.deepStrictEqual(
      local.requests().map(({ body }) => body),
      ["{}"]
    );
  }).pipe(Effect.scoped)
);
