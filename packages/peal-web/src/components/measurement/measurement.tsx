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
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

import { onReported } from "#errors/browser.ts";
import { setBrowserAnalyticsConsent } from "#measurement/atoms.ts";
import {
  errorOfReport,
  exceptionPropertiesOf,
} from "#measurement/exceptions.ts";
import { modeOf } from "#measurement/mode.ts";
import type { PrivacySignals } from "#measurement/mode.ts";
import { placeOf } from "#measurement/place.ts";
import { sanitized } from "#measurement/sanitize.ts";
import type { SanitizeState } from "#measurement/sanitize.ts";
import { loadSdk } from "#measurement/sdk.ts";
import type { MeasurementSdk } from "#measurement/sdk.ts";
import { applyState, notStarted, signedOut } from "#measurement/session.ts";
import type { Applied, MeasuredSession, Wanted } from "#measurement/session.ts";

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

// What the measurement holds while the layout lives: never in a module.
interface Runtime {
  sdk: MeasurementSdk | null;
  loading: boolean;
  applied: Applied;
  wanted: Wanted;
  state: SanitizeState;
}

// What the SDK is set up with for this person, on the page's state.
const sessionOf = (
  runtime: Runtime,
  settings: MeasurementSettings,
  userId: string
): MeasuredSession => ({
  beforeSend: (event) => sanitized(event, runtime.state),
  environment: settings.environment,
  hostname: window.location.hostname,
  token: settings.token,
  userId,
});

/**
 * The web app's measurement around the signed-in app's pages: after
 * hydration, it reads the page's path, decides its mode, loads the SDK the
 * first time a page is measured, and applies each change in place. It
 * hands errors the intake was sent to the SDK while it runs, and gives
 * the consent controls their state.
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

  // The choice made on this page, which holds until the page is left: the
  // server's answer otherwise.
  const [chosen, setChosen] = useState<{
    readonly consent: BrowserAnalyticsChoice;
    readonly decidedAt: string;
  } | null>(null);

  const consent = chosen?.consent ?? settings.consent;
  const decidedAt = chosen?.decidedAt ?? settings.decidedAt;

  const runtime = useRef<Runtime>({
    applied: notStarted,
    loading: false,
    sdk: null,
    state: { mode: "off", userId },
    wanted: { mode: "off", workspaceId: null },
  });

  useEffect(() => {
    const { current } = runtime;
    const place = placeOf(pathname);

    const mode = modeOf({
      place,
      settings: {
        consent,
        excludedWorkspaceIds: settings.excludedWorkspaceIds,
      },
      signals: signalsOf(),
    });

    current.state = { mode, userId };
    current.wanted = { mode, workspaceId: place?.workspaceId ?? null };

    const apply = (sdk: MeasurementSdk) => {
      current.applied = applyState(
        sdk,
        sessionOf(current, settings, userId),
        current.applied,
        current.wanted
      );
    };

    if (current.sdk !== null) {
      apply(current.sdk);

      return;
    }

    if (mode === "off" || current.loading) {
      return;
    }

    current.loading = true;

    const load = async () => {
      const sdk = await loadSdk();

      current.sdk = sdk;
      current.loading = false;
      // The page's latest state, whatever changed while it loaded.
      apply(sdk);
    };

    void load();
  }, [consent, pathname, settings, userId]);

  // Errors the intake was sent, already redacted, while the SDK runs.
  useEffect(() => {
    const { current } = runtime;

    const stopListening = onReported((report) => {
      current.sdk?.captureException(
        errorOfReport(report),
        exceptionPropertiesOf(report)
      );
    });

    return () => {
      stopListening();
      // Leaving the signed-in app: nothing more is measured or recorded.
      current.state = { mode: "off", userId };
      current.wanted = { mode: "off", workspaceId: null };

      if (current.sdk !== null) {
        current.applied = applyState(
          current.sdk,
          sessionOf(current, settings, userId),
          current.applied,
          current.wanted
        );
      }
    };
  }, [settings, userId]);

  const choose = useCallback(
    async (choice: BrowserAnalyticsChoice) => {
      const exit = await save({ payload: { choice } });

      if (Exit.isFailure(exit)) {
        return false;
      }

      setChosen({
        consent: exit.value.consent,
        decidedAt: DateTime.formatIso(exit.value.decidedAt),
      });
      router.refresh();

      return true;
    },
    [router, save]
  );

  const forget = useCallback(() => {
    const { current } = runtime;

    current.state = { mode: "off", userId };

    if (current.sdk !== null) {
      signedOut(current.sdk);
    }
  }, [userId]);

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
