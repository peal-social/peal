// What making an account starts: its welcome, on a server whose welcomes
// someone signs. The app here runs no worker, so a start fails, which shows
// that it was asked for, and that a sign-up answers whatever becomes of it.
// The welcome itself is in test/notifications.
import { assert, layer } from "@effect/vitest";
import { Effect, Logger, Schedule } from "effect";

import { newEmail, password, TestApp } from "./harness.ts";

const failed = "Starting a new account's welcome failed";

// A server whose log lines are kept in `lines`.
const appLogging = (
  lines: string[],
  env: Readonly<Record<string, string>> = {}
) =>
  TestApp.layerWith(
    env,
    Logger.layer([
      Logger.make(({ message }) => {
        lines.push(String(message));
      }),
    ])
  );

const signUp = Effect.gen(function* signUp() {
  const app = yield* TestApp;

  const { status } = yield* app.request("/api/auth/sign-up/email", {
    body: { email: newEmail("welcome"), name: "Ada Synthetic", password },
  });

  return status;
});

const signedLines: string[] = [];

layer(
  appLogging(signedLines, { PEAL_MAIL_WELCOME_SIGNER: "Camille Synthetic" }),
  { excludeTestServices: true, timeout: "60 seconds" }
)("an account made where someone signs the welcome", (it) => {
  it.effect("starts it, and is made though the start fails", () =>
    Effect.gen(function* starts() {
      assert.strictEqual(yield* signUp, 200);

      yield* Effect.sync(() => signedLines.includes(failed)).pipe(
        Effect.repeat({
          schedule: Schedule.spaced("50 millis"),
          times: 100,
          until: (logged) => logged,
        })
      );

      assert.strictEqual(
        signedLines.filter((line) => line === failed).length,
        1
      );
    })
  );
});

const unsignedLines: string[] = [];

layer(appLogging(unsignedLines), {
  excludeTestServices: true,
  timeout: "60 seconds",
})("an account made where nobody signs the welcome", (it) => {
  it.effect("starts none", () =>
    Effect.gen(function* startsNone() {
      assert.strictEqual(yield* signUp, 200);

      yield* Effect.sleep("500 millis");

      assert.notInclude(unsignedLines, failed);
      // The app's lines are read here.
      assert.isNotEmpty(unsignedLines);
    })
  );
});
