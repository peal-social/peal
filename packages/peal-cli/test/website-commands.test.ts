import { assert, describe, it } from "@effect/vitest";
import { Effect, Ref } from "effect";

import { filesLayer, signedIn } from "./signed-in.ts";

const inStudio = ["--workspace", "studio"];

const password = "abcd synthetic 1234 wxyz";

const connecting = (...rest: readonly string[]) => [
  "channels",
  "connect-website",
  "https://garden.example",
  "--user",
  "editor",
  ...rest,
  ...inStudio,
];

describe("peal channels connect-website", () => {
  it.effect("connects the site with the password piped in, never shown", () =>
    Effect.gen(function* connects() {
      const session = yield* signedIn();

      const printed = yield* session
        .piping(`${password}\n`)
        .printed(connecting());

      assert.include(
        printed,
        "Connected Synthetic Garden Journal (garden.example) to Studio"
      );
      assert.notInclude(printed, password);

      const { changes } = yield* Ref.get(session.studio.state);

      assert.include(
        changes,
        `website:connect:https://garden.example:editor:${password}`
      );
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("says why the site refused, and saves nothing", () =>
    Effect.gen(function* refused() {
      const session = yield* signedIn();

      const errors = yield* session
        .piping("synthetic refused password\n")
        .refused(connecting());

      assert.include(
        errors,
        "The website was not connected: the site refused the user name and the application password"
      );

      const { changes } = yield* Ref.get(session.studio.state);

      assert.isFalse(changes.some((change) => change.startsWith("website:")));
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );
});

const keyed = (...rest: readonly string[]) => [
  "channels",
  "connect-website-key",
  "--platform",
  "devto",
  ...rest,
  ...inStudio,
];

describe("peal channels connect-website-key", () => {
  it.effect("connects the account with the key piped in, never shown", () =>
    Effect.gen(function* connects() {
      const session = yield* signedIn();
      const key = "synthetic-devto-key";

      const printed = yield* session.piping(`${key}\n`).printed(keyed());

      assert.include(
        printed,
        "Connected Synthetic Gardener (dev.to/synthetic_gardener) to Studio"
      );
      assert.notInclude(printed, key);

      const { changes } = yield* Ref.get(session.studio.state);

      assert.include(changes, `website:key:devto:${key}`);
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("says why the platform refused the key", () =>
    Effect.gen(function* refused() {
      const session = yield* signedIn();

      const errors = yield* session
        .piping("synthetic refused key\n")
        .refused(keyed());

      assert.include(errors, "or the key: check them");
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );
});
