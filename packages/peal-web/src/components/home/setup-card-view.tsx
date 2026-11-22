"use client";

import { CheckIcon, CircleIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ChannelConnection, Platform } from "peal-contract";
import { displayVatRate } from "peal-contract";
import { Button, buttonVariants } from "peal-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "peal-ui/components/card";
import { Checkbox } from "peal-ui/components/checkbox";
import { Input } from "peal-ui/components/input";
import { Label } from "peal-ui/components/label";
import type { ChangeEvent, ReactNode, SubmitEvent } from "react";

import { useMoney } from "#billing/size.ts";
import { useChannelErrorText } from "#channels/channel-error-text.ts";
import type { ConnectRun, RunOutcome, RunStep } from "#channels/connect-run.ts";
import { PlatformMark } from "#components/channels/platform-mark.tsx";
import type { LinkComponent } from "#components/shell/sidebar-view.tsx";
import type { SetupCost, SetupOption } from "#home/setup.ts";

/** A row's name: the platform's, or LinkedIn's profile or pages. */
export const useSetupName = () => {
  const t = useTranslations("SetupCard");

  return (platform: Platform, connection?: ChannelConnection | null): string =>
    platform === "linkedin" &&
    (connection === "linkedinProfile" || connection === "linkedinPage")
      ? t(connection)
      : t("platform", { platform });
};

interface ChooseProps {
  readonly cost: SetupCost | null;
  readonly isPending: boolean;
  readonly onConnect: () => void;
  readonly onDismiss: () => void;
  readonly onToggle: (key: string, checked: boolean) => void;
  readonly onType: (key: string, value: string) => void;
  readonly options: readonly SetupOption[];
  /** Whether every row ticked holds what its sign-in needs. */
  readonly ready: boolean;
  readonly ticked: readonly string[];
  readonly typed: Readonly<Record<string, string>>;
  /** Whether X's row is closed, for want of a payment method. */
  readonly xClosed: boolean;
  readonly link: LinkComponent;
  /** New channel, for websites and chats. */
  readonly newChannelHref: string;
}

const CostLine = ({ cost }: { readonly cost: SetupCost | null }) => {
  const t = useTranslations("SetupCard.cost");
  const dollars = useMoney("usd");

  if (cost === null) {
    return null;
  }

  const text = () => {
    if (cost._tag === "free") {
      return t("free", { free: cost.free });
    }

    if (cost._tag === "needsPayment") {
      return t("needsPayment", { free: cost.free });
    }

    return t("adds", {
      included: dollars(cost.price.included),
      price: dollars(cost.price.excluded),
      rate: displayVatRate,
    });
  };

  return <p className="text-muted-foreground text-sm">{text()}</p>;
};

const fieldIdOf = (key: string) => `setup-${key.replace(":", "-")}-field`;

// A link around a message's words, for `t.rich`.
const linkTo = (Link: LinkComponent, href: string, chunks: ReactNode) => (
  <Link href={href} className="text-foreground underline underline-offset-4">
    {chunks}
  </Link>
);

const Choose = ({
  cost,
  isPending,
  link,
  newChannelHref,
  onConnect,
  onDismiss,
  onToggle,
  onType,
  options,
  ready,
  ticked,
  typed,
  xClosed,
}: ChooseProps) => {
  const t = useTranslations("SetupCard");
  const nameOf = useSetupName();

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (ready) {
      onConnect();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="contents">
      <CardContent>
        <div className="flex flex-col gap-3">
          <fieldset>
            <legend className="sr-only">{t("listLabel")}</legend>
            <ul className="divide-y rounded-lg border">
              {options.map((option) => {
                const id = `setup-${option.key.replace(":", "-")}`;
                const closed = option.platform === "x" && xClosed;
                const checked = ticked.includes(option.key);
                const fieldId = fieldIdOf(option.key);

                return (
                  <li
                    key={option.key}
                    className="flex flex-col gap-2 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <PlatformMark platform={option.platform} />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Label htmlFor={id}>
                          {nameOf(option.platform, option.connection)}
                        </Label>
                        {closed ? (
                          <span
                            id={`${id}-hint`}
                            className="text-muted-foreground text-sm"
                          >
                            {t("xClosed")}
                          </span>
                        ) : null}
                      </div>
                      <Checkbox
                        id={id}
                        checked={checked}
                        disabled={closed || isPending}
                        aria-describedby={closed ? `${id}-hint` : undefined}
                        onCheckedChange={(value) => {
                          onToggle(option.key, value === true);
                        }}
                      />
                    </div>
                    {checked && option.input !== null ? (
                      <div className="flex flex-col gap-1.5 pl-7">
                        <Label htmlFor={fieldId}>
                          {t(`${option.input}.label`)}
                        </Label>
                        <Input
                          id={fieldId}
                          name={fieldId}
                          type="text"
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          required={option.input === "instance"}
                          value={typed[option.key] ?? ""}
                          aria-describedby={`${fieldId}-hint`}
                          onChange={(event: ChangeEvent<HTMLInputElement>) => {
                            onType(option.key, event.target.value);
                          }}
                        />
                        <span
                          id={`${fieldId}-hint`}
                          className="text-muted-foreground text-sm"
                        >
                          {t(`${option.input}.hint`)}
                        </span>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </fieldset>
          <CostLine cost={cost} />
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            disabled={!ready || isPending}
            focusableWhenDisabled
          >
            {isPending ? t("leaving") : t("connect", { count: ticked.length })}
          </Button>
          <Button type="button" variant="outline" onClick={onDismiss}>
            {t("notNow")}
          </Button>
          <span className="text-muted-foreground text-sm">
            {t.rich("otherWays", {
              link: (chunks) => linkTo(link, newChannelHref, chunks),
            })}
          </span>
        </div>
      </CardFooter>
    </form>
  );
};

const OutcomeLine = ({
  outcome,
}: {
  readonly outcome: RunOutcome | undefined;
}) => {
  const t = useTranslations("SetupCard.status");
  const errors = useChannelErrorText();

  if (outcome === undefined) {
    return (
      <span className="text-muted-foreground text-sm">{t("waiting")}</span>
    );
  }

  if (outcome._tag === "connected") {
    return (
      <span className="text-muted-foreground text-sm">
        {t("connected", { handles: outcome.handles.join(", ") })}
      </span>
    );
  }

  if (outcome._tag === "failed") {
    return (
      <span className="text-destructive text-sm">{errors(outcome.error)}</span>
    );
  }

  return <span className="text-muted-foreground text-sm">{t("skipped")}</span>;
};

const RunningActions = ({
  isPending,
  name,
  onContinue,
  onSkip,
  onStop,
}: {
  readonly isPending: boolean;
  readonly name: string;
  readonly onContinue: () => void;
  readonly onSkip: () => void;
  readonly onStop: () => void;
}) => {
  const t = useTranslations("SetupCard");
  const handleContinue = onContinue;
  const handleSkip = onSkip;
  const handleStop = onStop;

  return (
    <>
      <Button
        type="button"
        disabled={isPending}
        focusableWhenDisabled
        onClick={handleContinue}
      >
        {isPending ? t("leaving") : t("running.continue", { name })}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={handleSkip}
      >
        {t("running.skip", { name })}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={handleStop}
      >
        {t("running.stop")}
      </Button>
    </>
  );
};

const DoneActions = ({
  connected,
  link: WritePost,
  onClose,
  writePostHref,
}: {
  readonly connected: number;
  readonly link: LinkComponent;
  readonly onClose: () => void;
  readonly writePostHref: string;
}) => {
  const t = useTranslations("SetupCard");
  const handleClose = onClose;

  // Nothing to post to: the one way on is to start again.
  if (connected === 0) {
    return (
      <Button type="button" onClick={handleClose}>
        {t("done.startOver")}
      </Button>
    );
  }

  return (
    <>
      <WritePost href={writePostHref} className={buttonVariants()}>
        {t("done.writePost")}
      </WritePost>
      <Button type="button" variant="outline" onClick={handleClose}>
        {t("done.close")}
      </Button>
    </>
  );
};

const OutcomeIcon = ({
  outcome,
}: {
  readonly outcome: RunOutcome | undefined;
}) => {
  if (outcome?._tag === "connected") {
    return <CheckIcon aria-hidden className="text-primary size-4" />;
  }

  if (outcome?._tag === "failed") {
    return <XIcon aria-hidden className="text-destructive size-4" />;
  }

  return <CircleIcon aria-hidden className="text-muted-foreground size-4" />;
};

/** The run's rows: each step's platform and what it came to. */
const RunRows = ({ run }: { readonly run: ConnectRun }) => {
  const nameOf = useSetupName();

  return (
    <ul className="divide-y rounded-lg border">
      {run.steps.map((step: RunStep, index) => (
        <li
          // A run holds a platform's way in once.
          key={`${step.platform}:${step.connection ?? ""}`}
          className="flex items-center gap-3 px-4 py-3"
        >
          <PlatformMark platform={step.platform} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium">
              {nameOf(step.platform, step.connection)}
            </span>
            <OutcomeLine outcome={run.outcomes[index]} />
          </div>
          <OutcomeIcon outcome={run.outcomes[index]} />
        </li>
      ))}
    </ul>
  );
};

export type SetupCardState =
  | ({ readonly _tag: "choose" } & Omit<
      ChooseProps,
      "isPending" | "link" | "newChannelHref"
    >)
  | {
      readonly _tag: "running";
      readonly run: ConnectRun;
      readonly next: RunStep;
      readonly onContinue: () => void;
      /** Goes past the next platform, kept as skipped. */
      readonly onSkip: () => void;
      readonly onStop: () => void;
    }
  | {
      readonly _tag: "done";
      readonly connected: number;
      readonly failed: number;
      readonly run: ConnectRun;
      readonly onClose: () => void;
    };

/**
 * The home page's setup card (DESIGN.md, Pages, Home): the platforms to
 * tick, the run under way with each one's outcome, or how it went. Links
 * come through `link`, so tests render each state without Next.
 */
export const SetupCardView = ({
  isPending,
  link,
  newChannelHref,
  state,
  writePostHref,
}: {
  readonly isPending: boolean;
  readonly link: LinkComponent;
  readonly newChannelHref: string;
  readonly state: SetupCardState;
  /** The composer, for the done state. */
  readonly writePostHref: string;
}) => {
  const t = useTranslations("SetupCard");
  const nameOf = useSetupName();

  return (
    <Card aria-labelledby="home-setup">
      <CardHeader>
        <CardTitle>
          <h2 id="home-setup">
            {state._tag === "done"
              ? t("done.title", { connected: state.connected })
              : t("title")}
          </h2>
        </CardTitle>
        <CardDescription>
          {state._tag === "choose" ? t("description") : null}
          {state._tag === "running" ? t("running.description") : null}
          {state._tag === "done"
            ? t("done.summary", {
                connected: state.connected,
                failed: state.failed,
              })
            : null}
        </CardDescription>
      </CardHeader>
      {state._tag === "choose" ? (
        <Choose
          {...state}
          isPending={isPending}
          link={link}
          newChannelHref={newChannelHref}
        />
      ) : (
        <>
          <CardContent>
            <RunRows run={state.run} />
          </CardContent>
          <CardFooter>
            <div className="flex flex-wrap items-center gap-2">
              {state._tag === "running" ? (
                <RunningActions
                  {...state}
                  isPending={isPending}
                  name={nameOf(state.next.platform, state.next.connection)}
                />
              ) : (
                <DoneActions
                  {...state}
                  link={link}
                  writePostHref={writePostHref}
                />
              )}
            </div>
          </CardFooter>
        </>
      )}
    </Card>
  );
};
