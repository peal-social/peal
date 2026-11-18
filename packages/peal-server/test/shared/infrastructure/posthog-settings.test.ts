import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit, Option, Redacted } from "effect";

import { postHogConfig } from "#shared/infrastructure/posthog-settings.ts";

const key = "phc_synthetic";

const read = (env: Record<string, string>) =>
  postHogConfig.parse(ConfigProvider.fromEnv({ env }));

const settingsOf = (env: Record<string, string>) =>
  read(env).pipe(Effect.map(Option.getOrThrow));

const fails = (env: Record<string, string>) =>
  read(env).pipe(
    Effect.exit,
    Effect.map((exit) => Exit.isFailure(exit))
  );

const userId = "6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f";
const otherId = "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";

describe("the PostHog settings", () => {
  it.effect("are off without a key, whatever else is set", () =>
    Effect.gen(function* withoutKey() {
      assert.isTrue(Option.isNone(yield* read({})));
      assert.isTrue(Option.isNone(yield* read({ PEAL_POSTHOG_KEY: "  " })));
      assert.isTrue(
        Option.isNone(
          yield* read({
            PEAL_POSTHOG_HOST: "http://example.com",
            PEAL_POSTHOG_PROJECT_ID: "not digits",
          })
        )
      );
    })
  );

  it.effect("default to the EU Cloud and to development", () =>
    Effect.gen(function* defaults() {
      const settings = yield* settingsOf({ PEAL_POSTHOG_KEY: key });

      assert.strictEqual(Redacted.value(settings.key), key);
      assert.strictEqual(settings.host, "https://eu.i.posthog.com");
      assert.strictEqual(settings.environment, "development");
      assert.isTrue(Option.isNone(settings.erasure));
      assert.strictEqual(settings.excluded.size, 0);
      assert.isFalse(settings.web);
    })
  );

  it.effect("measure the web app only when PEAL_POSTHOG_WEB is on", () =>
    Effect.gen(function* web() {
      const on = yield* settingsOf({
        PEAL_POSTHOG_KEY: key,
        PEAL_POSTHOG_WEB: "on",
      });

      assert.isTrue(on.web);

      const off = yield* settingsOf({
        PEAL_POSTHOG_KEY: key,
        PEAL_POSTHOG_WEB: "off",
      });

      assert.isFalse(off.web);
      assert.isTrue(
        yield* fails({ PEAL_POSTHOG_KEY: key, PEAL_POSTHOG_WEB: "yes" })
      );
      // Read only with a key.
      assert.isTrue(Option.isNone(yield* read({ PEAL_POSTHOG_WEB: "yes" })));
    })
  );

  it.effect("name production under NODE_ENV=production", () =>
    Effect.gen(function* production() {
      const settings = yield* settingsOf({
        NODE_ENV: "production",
        PEAL_POSTHOG_KEY: key,
      });

      assert.strictEqual(settings.environment, "production");

      const named = yield* settingsOf({
        NODE_ENV: "production",
        PEAL_POSTHOG_ENVIRONMENT: "sandbox",
        PEAL_POSTHOG_KEY: key,
      });

      assert.strictEqual(named.environment, "sandbox");
      assert.isTrue(
        yield* fails({
          PEAL_POSTHOG_ENVIRONMENT: "Prod uction",
          PEAL_POSTHOG_KEY: key,
        })
      );
    })
  );

  it.effect(
    "take https, or http on a loopback host, without trailing slashes",
    () =>
      Effect.gen(function* hosts() {
        const local = yield* settingsOf({
          PEAL_POSTHOG_HOST: "http://127.0.0.1:18080//",
          PEAL_POSTHOG_KEY: key,
        });

        assert.strictEqual(local.host, "http://127.0.0.1:18080");

        const own = yield* settingsOf({
          PEAL_POSTHOG_HOST: "https://analytics.example.com/",
          PEAL_POSTHOG_KEY: key,
        });

        assert.strictEqual(own.host, "https://analytics.example.com");
        assert.isTrue(
          yield* fails({
            PEAL_POSTHOG_HOST: "http://analytics.example.com",
            PEAL_POSTHOG_KEY: key,
          })
        );
        assert.isTrue(
          yield* fails({
            PEAL_POSTHOG_HOST: "https://analytics.example.com/?token=x",
            PEAL_POSTHOG_KEY: key,
          })
        );
      })
  );

  it.effect(
    "delete persons with the personal key and the project id together",
    () =>
      Effect.gen(function* erasure() {
        const settings = yield* settingsOf({
          PEAL_POSTHOG_APP_HOST: "https://app.example.com/",
          PEAL_POSTHOG_KEY: key,
          PEAL_POSTHOG_PERSONAL_API_KEY: "phx_synthetic",
          PEAL_POSTHOG_PROJECT_ID: "12345",
        });

        const erasing = Option.getOrThrow(settings.erasure);

        assert.strictEqual(erasing.projectId, "12345");
        assert.strictEqual(erasing.appHost, "https://app.example.com");
        assert.strictEqual(
          Redacted.value(erasing.personalKey),
          "phx_synthetic"
        );

        const byDefault = yield* settingsOf({
          PEAL_POSTHOG_KEY: key,
          PEAL_POSTHOG_PERSONAL_API_KEY: "phx_synthetic",
          PEAL_POSTHOG_PROJECT_ID: "12345",
        });

        assert.strictEqual(
          Option.getOrThrow(byDefault.erasure).appHost,
          "https://eu.posthog.com"
        );
      })
  );

  it.effect("stop the server with one of the pair alone", () =>
    Effect.gen(function* halfErasure() {
      assert.isTrue(
        yield* fails({
          PEAL_POSTHOG_KEY: key,
          PEAL_POSTHOG_PERSONAL_API_KEY: "phx_synthetic",
        })
      );
      assert.isTrue(
        yield* fails({
          PEAL_POSTHOG_KEY: key,
          PEAL_POSTHOG_PROJECT_ID: "12345",
        })
      );
      assert.isTrue(
        yield* fails({
          PEAL_POSTHOG_KEY: key,
          PEAL_POSTHOG_PERSONAL_API_KEY: "phx_synthetic",
          PEAL_POSTHOG_PROJECT_ID: "project",
        })
      );
    })
  );

  it.effect(
    "read the excluded users and workspaces, and stop on anything else",
    () =>
      Effect.gen(function* excluded() {
        const settings = yield* settingsOf({
          PEAL_POSTHOG_EXCLUDED_IDS: ` ${userId}, ,${otherId} ,`,
          PEAL_POSTHOG_KEY: key,
        });

        assert.deepStrictEqual(
          [...settings.excluded].toSorted(),
          [otherId, userId].toSorted()
        );
        assert.isTrue(
          yield* fails({
            PEAL_POSTHOG_EXCLUDED_IDS: `${userId},someone@example.com`,
            PEAL_POSTHOG_KEY: key,
          })
        );
      })
  );
});
