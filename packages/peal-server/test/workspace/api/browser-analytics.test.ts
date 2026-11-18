// What GET /api/me says of the web app's measurement, who it is null for,
// and which requests' web app session joins the server's events.
import { assert, describe, it } from "@effect/vitest";
import { DateTime, Duration, Option } from "effect";
import { browserAnalyticsConsentDays } from "peal-contract";

import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import {
  analyticsActorOf,
  browserSessionOf,
} from "#workspace/api/principal.ts";
import { browserAnalyticsOf } from "#workspace/api/session.ts";
import { Account } from "#workspace/domain/account.ts";
import { ApiKeyPrincipal } from "#workspace/domain/api-key-principal.ts";
import {
  consentStandsFor,
  standingConsent,
} from "#workspace/domain/browser-analytics-consent.ts";
import { UserPrincipal } from "#workspace/domain/user-principal.ts";

const userId = UserIdSchema.make("3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f");
const staffId = UserIdSchema.make("8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0db4");
const own = WorkspaceIdSchema.make("4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f70");

const excludedOwn = WorkspaceIdSchema.make(
  "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a81"
);

// Excluded, but not one of the person's.
const elsewhere = WorkspaceIdSchema.make(
  "6f7a8b9c-0d1e-4f2a-9b3c-4d5e6f7a8b92"
);

const now = DateTime.makeUnsafe("2026-11-18T10:00:00.000Z");

// A UUIDv7, as the web app's SDK makes its session ids.
const browserSessionId = "019a7b2c-3d4e-7f50-8a1b-2c3d4e5f6a7b";

const accountWith = (
  consent: Account["browserAnalyticsConsent"] = Option.none()
) =>
  new Account({
    ban: Option.none(),
    browserAnalyticsConsent: consent,
    email: "synthetic@example.test",
    emailVerified: true,
    hasPassword: true,
    id: userId,
    image: Option.none(),
    locale: "en",
    name: "Synthetic person",
    twoStepEnabled: false,
    workspaces: [
      { id: own, name: "Own", role: "owner", slug: "own" },
      { id: excludedOwn, name: "Excluded", role: "owner", slug: "excluded" },
    ],
  });

const inPerson = new UserPrincipal({
  impersonatedBy: Option.none(),
  oauth: Option.none(),
  userId,
});

const impersonated = new UserPrincipal({
  impersonatedBy: Option.some(staffId),
  oauth: Option.none(),
  userId,
});

const throughApplication = new UserPrincipal({
  impersonatedBy: Option.none(),
  oauth: Option.some({
    clientId: "synthetic-agent",
    scopes: ["workspace:read"],
    workspaceId: Option.none(),
  }),
  userId,
});

const measured = Option.some({
  environment: "test",
  excluded: new Set<string>([excludedOwn, elsewhere]),
  token: "phc_synthetic",
});

const current = (
  principal: UserPrincipal,
  account: Account = accountWith()
) => ({ account, principal, workspaces: [] });

describe("the web app's measurement in GET /api/me", () => {
  it("is null where the server measures nothing", () => {
    assert.isNull(browserAnalyticsOf(current(inPerson), Option.none(), now));
  });

  it("is null for staff acting as the person, and through an application", () => {
    assert.isNull(browserAnalyticsOf(current(impersonated), measured, now));
    assert.isNull(
      browserAnalyticsOf(current(throughApplication), measured, now)
    );
  });

  it("is null for a person the operator excluded", () => {
    assert.isNull(
      browserAnalyticsOf(
        current(inPerson),
        Option.some({
          environment: "test",
          excluded: new Set<string>([userId]),
          token: "phc_synthetic",
        }),
        now
      )
    );
  });

  it("lists only the person's own excluded workspaces", () => {
    assert.deepStrictEqual(
      browserAnalyticsOf(current(inPerson), measured, now),
      {
        consent: "undecided",
        decidedAt: null,
        environment: "test",
        excludedWorkspaceIds: [excludedOwn],
        token: "phc_synthetic",
      }
    );
  });

  it("reads a choice as undecided once it is older than six months", () => {
    const decidedAt = DateTime.subtract(now, { days: 184 });
    const old = accountWith(Option.some({ choice: "granted", decidedAt }));

    assert.strictEqual(
      browserAnalyticsOf(current(inPerson, old), measured, now)?.consent,
      "undecided"
    );

    const recent = DateTime.subtract(now, { days: 182 });

    const kept = accountWith(
      Option.some({ choice: "refused", decidedAt: recent })
    );

    const answered = browserAnalyticsOf(current(inPerson, kept), measured, now);

    assert.strictEqual(answered?.consent, "refused");
    assert.isTrue(
      answered?.decidedAt !== null &&
        answered?.decidedAt !== undefined &&
        DateTime.Equivalence(answered.decidedAt, recent)
    );
  });

  it("keeps a choice as long as the contract tells clients", () => {
    assert.strictEqual(
      Duration.toDays(consentStandsFor),
      browserAnalyticsConsentDays
    );

    const decidedAt = DateTime.subtract(now, {
      days: browserAnalyticsConsentDays,
    });

    assert.isTrue(
      Option.isNone(
        standingConsent(Option.some({ choice: "granted", decidedAt }), now)
      )
    );
  });
});

describe("the web app's session a request names", () => {
  it("is taken when it is a UUID, and ignored otherwise", () => {
    assert.deepStrictEqual(
      browserSessionOf({ "x-posthog-session-id": browserSessionId }),
      Option.some(browserSessionId)
    );
    assert.isTrue(Option.isNone(browserSessionOf({})));
    assert.isTrue(
      Option.isNone(browserSessionOf({ "x-posthog-session-id": "a; b" }))
    );
  });

  it("joins only a person in their own session", () => {
    const session = Option.some(browserSessionId);

    assert.deepStrictEqual(
      analyticsActorOf(inPerson, session).sessionId,
      session
    );
    assert.isTrue(
      Option.isNone(analyticsActorOf(impersonated, session).sessionId)
    );
    assert.isTrue(
      Option.isNone(analyticsActorOf(throughApplication, session).sessionId)
    );
    assert.isTrue(
      Option.isNone(
        analyticsActorOf(
          new ApiKeyPrincipal({
            apiKeyId: "synthetic-key",
            permissions: ["post:read"],
            workspaceId: own,
          }),
          session
        ).sessionId
      )
    );
  });
});
