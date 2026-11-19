"use client";

import { useAtomSet } from "@effect/atom-react";
import { DateTime, Exit, Option, Schema } from "effect";
import { usePathname, useRouter } from "next/navigation";
import type { BrowserAnalyticsChoice } from "peal-contract";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

import { onReported } from "#errors/browser.ts";
import { setBrowserAnalyticsConsent } from "#measurement/atoms.ts";
import { makeController } from "#measurement/controller.ts";
import {
  errorOfReport,
  exceptionPropertiesOf,
} from "#measurement/exceptions.ts";
import { modeOf } from "#measurement/mode.ts";
import type { PrivacySignals } from "#measurement/mode.ts";
import { placeOf } from "#measurement/place.ts";
import { loadSdk } from "#measurement/sdk.ts";
import { nameSessionWith } from "#measurement/session-header.ts";
import {
  answerNews,
  consentNow,
  tabNewsOf,
  tabsKey,
  tellTabs,
} from "#measurement/tabs.ts";
import type { Chosen } from "#measurement/tabs.ts";

/** What GET /api/me says of the measurement, as the layout hands it over. */
export interface MeasurementSettings {
  readonly token: string;
  readonly environment: string;
  readonly consent: "granted" | "refused" | "undecided";
  /** When the choice was made, an ISO instant; none while undecided. */
  readonly decidedAt: string | null;
  readonly excludedWorkspaceIds: readonly string[];
}

/** What the consent controls read and do. */
export interface MeasurementConsent {
  readonly consent: MeasurementSettings["consent"];
  readonly decidedAt: Date | null;
  /** Whether the browser asks not to be tracked: nothing is measured. */
  readonly untracked: boolean;
  /** Keeps the choice, then applies it in place; false when it failed. */
  readonly choose: (choice: BrowserAnalyticsChoice) => Promise<boolean>;
}

const ConsentContext = createContext<MeasurementConsent | null>(null);

// Signing out while the measurement runs forgets what the SDK kept.
const SignOutContext = createContext<() => void>(() => {
  // Nothing measured, nothing to forget.
});

/** The consent controls' state, none where the web app measures nothing. */
export const useMeasurementConsent = (): MeasurementConsent | null =>
  use(ConsentContext);

/** Call before signing out: the SDK forgets the person, if it runs. */
export const useMeasurementSignOut = (): (() => void) => use(SignOutContext);

const decodeDoNotTrack = Schema.decodeUnknownOption(
  Schema.Struct({ doNotTrack: Schema.Literals(["1", "yes"]) })
);

const decodeGlobalPrivacyControl = Schema.decodeUnknownOption(
  Schema.Struct({ globalPrivacyControl: Schema.Literal(true) })
);

// Whether the browser asks not to be tracked: Do Not Track or Global
// Privacy Control.
const untrackedNow = (): boolean =>
  Option.isSome(decodeDoNotTrack(navigator)) ||
  Option.isSome(decodeDoNotTrack(window)) ||
  Option.isSome(decodeGlobalPrivacyControl(navigator));

const signalsOf = (): PrivacySignals => {
  const untracked = untrackedNow();

  return { doNotTrack: untracked, globalPrivacyControl: untracked };
};

const subscribeToNothing = () => () => {
  // What the browser asks does not change while the page lives.
};

// The server renders as if the browser asked nothing; the browser's own
// answer comes after hydration.
const useUntracked = (): boolean =>
  useSyncExternalStore(subscribeToNothing, untrackedNow, () => false);

// The measurement of this page load: one, as the SDK is, so a remount
// goes on from where the last one left it.
const controller = makeController(loadSdk);

/**
 * The web app's measurement around the signed-in app's pages: after
 * hydration, it reads the page's path, decides its mode and asks the
 * page load's controller for it, which loads the SDK the first time a
 * page is measured and applies each change in place. It hands errors the
 * intake was sent to the SDK, follows the choices and sign-outs of the
 * browser's other tabs and the server's answer when the tab is shown
 * again, and gives the consent controls their state.
 */
export const Measurement = ({
  children,
  settings,
  userId,
}: {
  readonly children: ReactNode;
  readonly settings: MeasurementSettings;
  readonly userId: string;
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const save = useAtomSet(setBrowserAnalyticsConsent, { mode: "promiseExit" });
  const untracked = useUntracked();
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const { environment, token } = settings;
  const excluded = settings.excludedWorkspaceIds.join(",");

  const { consent, decidedAt } = consentNow(
    { consent: settings.consent, decidedAt: settings.decidedAt },
    chosen
  );

  useEffect(() => {
    const place = placeOf(pathname);

    const mode = modeOf({
      place,
      settings: {
        consent,
        excludedWorkspaceIds: excluded === "" ? [] : excluded.split(","),
      },
      signals: signalsOf(),
    });

    void controller.ask({
      session: {
        environment,
        hostname: window.location.hostname,
        origin: window.location.origin,
        token,
        userId,
      },
      wanted: { mode, workspaceId: place?.workspaceId ?? null },
    });
  }, [consent, environment, excluded, pathname, token, userId]);

  // Errors the intake was sent, already redacted, while the SDK runs; and,
  // on leaving the signed-in app, nothing more measured or recorded.
  useEffect(() => {
    // The app's own requests name the session, as its HTTP client never
    // sees the SDK's patch of `fetch`.
    const stopNaming = nameSessionWith(controller.session);

    const stopListening = onReported((report) => {
      controller
        .sdk()
        ?.captureException(
          errorOfReport(report),
          exceptionPropertiesOf(report)
        );
    });

    return () => {
      stopNaming();
      stopListening();
      controller.park();
    };
  }, []);

  // What the browser's other tabs decide, and the server's answer once the
  // tab is shown again: a choice made elsewhere, or one that expired.
  useEffect(() => {
    const heard = (change: StorageEvent) => {
      if (change.key !== tabsKey) {
        return;
      }

      Option.match(tabNewsOf(change.newValue), {
        onNone: () => {
          // Nothing of the measurement's.
        },
        onSome: (news) => {
          // Signed out, or someone else signed in: nothing more of this
          // page is the person's until it is read again.
          if (news.kind === "signedOut" || news.kind === "signedIn") {
            controller.signOut();
          }

          router.refresh();
        },
      });
    };

    // Shown again: GET /api/me alone, and the page refreshed only when
    // it says something else; never in a browser that is not measured.
    const reread = async () => {
      const answer = await fetch("/api/me", { credentials: "same-origin" });

      if (!answer.ok) {
        return;
      }

      const news = answerNews(await answer.text(), {
        consent,
        decidedAt,
        userId,
      });

      // Someone else signed in in another tab: this page names nobody's
      // session until it is read again.
      if (news === "otherPerson") {
        controller.signOut();
      }

      if (news !== "same") {
        router.refresh();
      }
    };

    const shown = () => {
      if (document.visibilityState !== "visible" || untracked) {
        return;
      }

      reread().catch(() => {
        // Read again the next time the tab is shown.
      });
    };

    window.addEventListener("storage", heard);
    document.addEventListener("visibilitychange", shown);

    return () => {
      window.removeEventListener("storage", heard);
      document.removeEventListener("visibilitychange", shown);
    };
  }, [consent, decidedAt, router, untracked, userId]);

  const choose = useCallback(
    async (choice: BrowserAnalyticsChoice) => {
      const exit = await save({ payload: { choice } });

      if (Exit.isFailure(exit)) {
        return false;
      }

      const made = {
        consent: exit.value.consent,
        decidedAt: DateTime.formatIso(exit.value.decidedAt),
      };

      setChosen({ ...made, over: { consent, decidedAt } });
      tellTabs({ ...made, kind: "chosen" });
      router.refresh();

      return true;
    },
    [consent, decidedAt, router, save]
  );

  const forget = useCallback(() => {
    controller.signOut();
    tellTabs({ kind: "signedOut" });
  }, []);

  const measured = useMemo(
    () => ({
      choose,
      consent,
      decidedAt: decidedAt === null ? null : new Date(decidedAt),
      untracked,
    }),
    [choose, consent, decidedAt, untracked]
  );

  return (
    <SignOutContext value={forget}>
      <ConsentContext value={measured}>{children}</ConsentContext>
    </SignOutContext>
  );
};
