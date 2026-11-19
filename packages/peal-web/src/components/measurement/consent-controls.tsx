"use client";

import type { BrowserAnalyticsChoice } from "peal-contract";
import { useState } from "react";

import { useHydrated } from "#components/media/use-hydrated.ts";
import { asksConsent } from "#measurement/asks.ts";

import { ConsentCardView, ConsentSettingView } from "./consent-views.tsx";
import { useMeasurementConsent } from "./measurement.tsx";
import type { MeasurementConsent } from "./measurement.tsx";

// A choice being saved, and whether the last one failed.
const useChoosing = (measurement: MeasurementConsent | null) => {
  const [pending, setPending] = useState<BrowserAnalyticsChoice | null>(null);
  const [failed, setFailed] = useState(false);

  const onChoose = (choice: BrowserAnalyticsChoice) => {
    if (measurement === null || pending !== null) {
      return;
    }

    setPending(choice);
    setFailed(false);

    const choosing = async () => {
      const saved = await measurement.choose(choice);

      setPending(null);
      setFailed(!saved);
    };

    void choosing();
  };

  return { failed, onChoose, pending };
};

/**
 * The question on a workspace's home, while the person has not chosen and
 * the web app measures: it leaves once answered. Never where the browser
 * asks not to be tracked, as nothing is measured there.
 */
export const ConsentCard = ({
  privacyUrl,
}: {
  readonly privacyUrl: string | null;
}) => {
  const measurement = useMeasurementConsent();
  const hydrated = useHydrated();
  const choosing = useChoosing(measurement);

  if (!hydrated || measurement === null || !asksConsent(measurement)) {
    return null;
  }

  return <ConsentCardView {...choosing} privacyUrl={privacyUrl} />;
};

/** The account page's row, where the person changes their mind. */
export const ConsentSetting = () => {
  const measurement = useMeasurementConsent();
  const choosing = useChoosing(measurement);

  if (measurement === null) {
    return null;
  }

  return (
    <ConsentSettingView
      {...choosing}
      consent={measurement.consent}
      decidedAt={measurement.decidedAt}
    />
  );
};
