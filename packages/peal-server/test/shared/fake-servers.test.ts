import { once } from "node:events";
import { connect } from "node:net";

import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { fakeHttpServer } from "#test/channels/fakes/fake-http-server.ts";
import {
  empty,
  platformServer,
} from "#test/publishing/fakes/platform-server.ts";

// A client that sends a request's head and part of its body, then goes
// away, as a fetch aborted by its timeout does: the fake's read of the
// body fails, after the test that sent it may have ended.
const cutOff = (origin: string) =>
  Effect.promise(async () => {
    const socket = connect(Number(new URL(origin).port), "127.0.0.1");

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

// What the fake makes of the next request: it still answers, and keeps
// that one alone.
const answered = async (origin: string) => {
  const response = await fetch(`${origin}/next`);

  return response.status;
};

it.effect(
  "the fake HTTP server forgets a request whose client went away before its body",
  () =>
    Effect.gen(function* fakeServer() {
      const local = yield* fakeHttpServer(() => ({ status: 204 }));

      yield* cutOff(local.url);

      assert.strictEqual(
        yield* Effect.promise(async () => await answered(local.url)),
        204
      );
      assert.deepStrictEqual(
        local.requests().map(({ path }) => path),
        ["/next"]
      );
    }).pipe(Effect.scoped)
);

it.effect(
  "the fake platform forgets a request whose client went away before its body",
  () =>
    Effect.gen(function* fakePlatform() {
      const local = yield* platformServer(() => empty(204));

      yield* cutOff(local.url);

      assert.strictEqual(
        yield* Effect.promise(async () => await answered(local.url)),
        204
      );
      assert.deepStrictEqual(
        local.requests().map(({ path }) => path),
        ["/next"]
      );
    }).pipe(Effect.scoped)
);
