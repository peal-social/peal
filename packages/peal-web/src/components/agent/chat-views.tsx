"use client";

import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@ui-sdk/react/collapsible";
import { DateTime, Match } from "effect";
import {
  ArrowUpIcon,
  ChevronRightIcon,
  CopyIcon,
  SquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import { useFormatter, useTimeZone, useTranslations } from "next-intl";
import type {
  AgentApproval,
  AgentCard,
  AgentMessage,
  AgentOffReason,
  AgentRating,
  AgentStep,
} from "peal-contract/agent";
import { maxAgentMessageLength } from "peal-contract/agent";
import { Badge } from "peal-ui/components/badge";
import { Button, buttonVariants } from "peal-ui/components/button";
import { EmptyStateTitle } from "peal-ui/components/empty-state";
import { cn } from "peal-ui/lib/utils";
import { Fragment, useId } from "react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";

import { segmentsOf } from "#agent/answer-segments.ts";
import type { AnswerSegments } from "#agent/answer-segments.ts";
import { relativeDayOf } from "#agent/history.ts";
import type { RunRefusal } from "#agent/refusal.ts";
import type { ChatState, RunProblem } from "#agent/run-state.ts";
import { approvalKindOf, stepKindOf } from "#agent/steps.ts";
import type { ApprovalKind } from "#agent/steps.ts";
import { AgentMarkdown } from "#components/agent/agent-markdown.tsx";
import type { LinkComponent } from "#components/shell/sidebar-view.tsx";

type Translate = ReturnType<typeof useTranslations<"Agent">>;

type Format = ReturnType<typeof useFormatter>;

/** Where the chat's links lead: an item's page, and the agent's settings. */
export interface ChatLinks {
  readonly link: LinkComponent;
  readonly post: (postId: string) => string;
  readonly thread: (threadId: string) => string;
}

/** A channel's name, or null for one the workspace no longer has. */
export type ChannelNameOf = (channelId: string) => string | null;

/**
 * Words that wait on work under way: a light passes along them (DESIGN.md,
 * "The agent"), and with reduced motion they stay still and muted.
 */
export const Shimmer = ({ children }: { readonly children: ReactNode }) => (
  <span className="text-shimmer">{children}</span>
);

/** A step's line: in the present while it runs, in the past once done. */
export const stepLine = (t: Translate, step: AgentStep): string => {
  const kind = stepKindOf(step.tool);

  return Match.value(step.state).pipe(
    Match.when("running", () => t("steps.running", { kind })),
    Match.when("done", () => t("steps.done", { kind })),
    Match.when("refused", () =>
      t("steps.refused", { step: t("steps.done", { kind }) })
    ),
    Match.when("failed", () =>
      t("steps.failed", { step: t("steps.done", { kind }) })
    ),
    Match.exhaustive
  );
};

/** How long an answer took: in seconds under a minute, then in minutes. */
export const workedLine = (t: Translate, durationMs: number): string => {
  const seconds = Math.max(1, Math.round(durationMs / 1000));

  return seconds < 60
    ? t("workedSeconds", { seconds })
    : t("workedMinutes", { minutes: Math.round(seconds / 60) });
};

// A step's line: live, with the shimmer, while its run writes it.
const StepLine = ({
  live,
  step,
}: {
  readonly live: boolean;
  readonly step: AgentStep;
}) => {
  const t = useTranslations("Agent");

  return (
    <p className="text-muted-foreground text-sm">
      {live && step.state === "running" ? (
        <Shimmer>{stepLine(t, step)}</Shimmer>
      ) : (
        stepLine(t, step)
      )}
    </p>
  );
};

// The text written before each step, then the step's line, in order.
const Segments = ({
  link,
  live,
  segments,
}: {
  readonly link: LinkComponent;
  readonly live: boolean;
  readonly segments: AnswerSegments["steps"];
}) =>
  segments.map(({ before, step }) => (
    <Fragment key={step.callId}>
      {before.trim() === "" ? null : (
        <AgentMarkdown link={link} text={before} />
      )}
      <StepLine live={live} step={step} />
    </Fragment>
  ));

/**
 * An answer's text with its steps where they fall. While it runs, the
 * text streams with each step's live line in its place; once done, the
 * steps and the text before them fold into "Worked for 7 seconds", which
 * opens them in order, and the text after the last step, the answer,
 * stays in view. An answer without steps has no fold.
 */
export const AnswerTextView = ({
  durationMs,
  link,
  running,
  steps,
  text,
}: {
  readonly durationMs: number | null;
  readonly link: LinkComponent;
  readonly running: boolean;
  readonly steps: readonly AgentStep[];
  readonly text: string;
}) => {
  const t = useTranslations("Agent");
  const { answer, steps: segments } = segmentsOf(text, steps);

  const waiting =
    running &&
    answer.trim() === "" &&
    !steps.some(({ state }) => state === "running");

  const folded = !running && durationMs !== null && segments.length > 0;

  return (
    <>
      {folded ? (
        <Collapsible className="flex flex-col gap-3">
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 group/steps inline-flex w-fit items-center gap-1 rounded-sm text-sm outline-none focus-visible:ring-3">
            {workedLine(t, durationMs)}
            <ChevronRightIcon
              aria-hidden
              className="size-3.5 transition-transform group-data-[open]/steps:rotate-90 motion-reduce:transition-none"
            />
          </CollapsibleTrigger>
          <CollapsiblePanel className="flex flex-col gap-3 border-l pl-3">
            <Segments link={link} live={false} segments={segments} />
          </CollapsiblePanel>
        </Collapsible>
      ) : (
        <Segments link={link} live={running} segments={segments} />
      )}
      {answer.trim() === "" ? null : (
        <AgentMarkdown link={link} text={answer} />
      )}
      {waiting ? (
        <p className="text-sm">
          <Shimmer>{t("thinking")}</Shimmer>
        </p>
      ) : null}
    </>
  );
};

const namesOf = (
  channelIds: readonly string[],
  nameOf: ChannelNameOf
): readonly string[] =>
  channelIds.flatMap((id) => {
    const name = nameOf(id);

    return name === null ? [] : [name];
  });

const ChannelBadges = ({
  channelIds,
  nameOf,
}: {
  readonly channelIds: readonly string[];
  readonly nameOf: ChannelNameOf;
}) => {
  const t = useTranslations("Agent");
  const names = namesOf(channelIds, nameOf);
  const unknown = channelIds.length - names.length;

  return names.length === 0 && unknown === 0 ? null : (
    <ul className="flex flex-wrap gap-1.5" aria-label={t("channels")}>
      {names.map((name) => (
        <li key={name}>
          <Badge variant="outline">{name}</Badge>
        </li>
      ))}
      {unknown > 0 ? (
        <li>
          <Badge variant="outline">
            {t("otherChannels", { count: unknown })}
          </Badge>
        </li>
      ) : null}
    </ul>
  );
};

const timeOf = (format: Format, at: DateTime.Utc): string =>
  format.dateTime(DateTime.toDate(at), {
    dateStyle: "full",
    timeStyle: "short",
  });

// When an approved change happens: its time, or at once for a post
// published now; nothing for a change that has no time.
const whenOf = (
  t: Translate,
  format: Format,
  kind: ApprovalKind,
  at: DateTime.Utc | null
): string | null => {
  if (at !== null) {
    return t("approval.at", { at: timeOf(format, at) });
  }

  return kind === "publish" ? t("approval.now") : null;
};

/**
 * A change the agent asks to make, from the tool's request, never its
 * words: what it does, the text whole, the channels by name, when, then
 * **Approve** and **Decline**; once answered, how.
 */
export const ApprovalCardView = ({
  approval,
  busy,
  links,
  nameOf,
  notDone = false,
  onAnswer,
}: {
  readonly approval: AgentApproval;
  /** A run goes on in the chat: nothing can be answered until it ends. */
  readonly busy: boolean;
  /** Approved, the change was refused or failed: it was not made. */
  readonly notDone?: boolean;
  readonly links: ChatLinks;
  readonly nameOf: ChannelNameOf;
  readonly onAnswer: (approved: boolean) => void;
}) => {
  const t = useTranslations("Agent");
  const format = useFormatter();
  const titleId = useId();
  const { link: AppLink } = links;
  const kind = approvalKindOf(approval.tool, approval.at);

  const when = whenOf(t, format, kind, approval.at);

  return (
    <section
      aria-labelledby={titleId}
      className="bg-card flex flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={titleId} className="text-sm font-semibold">
          {t("approval.title", { kind })}
        </h3>
        {approval.state === "pending" ? null : (
          <Badge variant="outline">
            {t("approval.state", {
              state:
                approval.state === "approved" && notDone
                  ? "notDone"
                  : approval.state,
            })}
          </Badge>
        )}
      </div>
      {approval.text === null ? null : (
        <blockquote
          dir="auto"
          className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap"
        >
          {approval.text}
        </blockquote>
      )}
      <ChannelBadges channelIds={approval.channelIds} nameOf={nameOf} />
      {when === null ? null : (
        <p className="text-muted-foreground text-sm">{when}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {approval.state === "pending" ? (
          <>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                onAnswer(true);
              }}
            >
              {t("approval.approve")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                onAnswer(false);
              }}
            >
              {t("approval.decline")}
            </Button>
          </>
        ) : null}
        {/* An approved deletion leaves no post to open. */}
        {approval.postId === null ||
        (kind === "delete" && approval.state === "approved") ? null : (
          <AppLink
            href={links.post(approval.postId)}
            className="text-brand-text ml-auto text-sm underline-offset-2 hover:underline"
          >
            {t("approval.openPost")}
          </AppLink>
        )}
        {approval.threadId === null ? null : (
          <AppLink
            href={links.thread(approval.threadId)}
            className="text-brand-text ml-auto text-sm underline-offset-2 hover:underline"
          >
            {t("approval.openThread")}
          </AppLink>
        )}
      </div>
    </section>
  );
};

/** An item the agent made or changed, linking to its page. */
export const ResultCardView = ({
  card,
  links,
  nameOf,
}: {
  readonly card: AgentCard;
  readonly links: ChatLinks;
  readonly nameOf: ChannelNameOf;
}) => {
  const t = useTranslations("Agent");
  const format = useFormatter();
  const { link: AppLink } = links;

  const body = (
    <>
      <span className="text-muted-foreground text-xs font-medium">
        {card._tag === "post"
          ? t("card.post", { action: card.action })
          : t("card.thread", { action: card.action })}
      </span>
      <span dir="auto" className="line-clamp-2 text-sm">
        {card.excerpt}
      </span>
      {card._tag === "post" ? (
        <>
          <ChannelBadges channelIds={card.channelIds} nameOf={nameOf} />
          {card.scheduledAt === null ? null : (
            <span className="text-muted-foreground text-xs">
              {t("card.goesOut", { at: timeOf(format, card.scheduledAt) })}
            </span>
          )}
        </>
      ) : null}
    </>
  );

  const frame = "bg-card flex flex-col gap-1.5 rounded-xl border p-3";

  if (card.action === "deleted") {
    return <div className={frame}>{body}</div>;
  }

  return (
    <AppLink
      href={
        card._tag === "post"
          ? links.post(card.postId)
          : links.thread(card.threadId)
      }
      className={cn(
        frame,
        "hover:bg-muted focus-visible:ring-ring/50 transition-colors outline-none focus-visible:ring-3"
      )}
    >
      {body}
    </AppLink>
  );
};

/** What the person does with a finished answer. */
export interface AnswerActions {
  readonly onCopy: (text: string) => void;
  readonly onRate: (messageId: string, rating: AgentRating | null) => void;
}

const AnswerFoot = ({
  actions,
  message,
}: {
  readonly actions: AnswerActions;
  readonly message: AgentMessage;
}) => {
  const t = useTranslations("Agent");

  const rate = (rating: AgentRating) => {
    actions.onRate(message.id, message.rating === rating ? null : rating);
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("rateUp")}
        aria-pressed={message.rating === "up"}
        onClick={() => {
          rate("up");
        }}
      >
        <ThumbsUpIcon aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("rateDown")}
        aria-pressed={message.rating === "down"}
        onClick={() => {
          rate("down");
        }}
      >
        <ThumbsDownIcon aria-hidden />
      </Button>
      {message.text.trim() === "" ? null : (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("copy")}
          onClick={() => {
            actions.onCopy(message.text);
          }}
        >
          <CopyIcon aria-hidden />
        </Button>
      )}
    </div>
  );
};

/** One message: the person's in a muted bubble, the agent's full width. */
export const MessageView = ({
  actions,
  busy,
  links,
  message,
  nameOf,
  onAnswer,
  running,
  saysFailure = true,
}: {
  readonly actions: AnswerActions;
  readonly busy: boolean;
  readonly links: ChatLinks;
  readonly message: AgentMessage;
  readonly nameOf: ChannelNameOf;
  readonly onAnswer: (callId: string, approved: boolean) => void;
  /** This is the answer being written now. */
  readonly running: boolean;
  /**
   * Whether a failed answer says so itself: not while the chat shows why
   * its last run failed, which says more.
   */
  readonly saysFailure?: boolean;
}) => {
  const t = useTranslations("Agent");

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p
          dir="auto"
          className="bg-muted max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap"
        >
          {message.text}
        </p>
      </div>
    );
  }

  return (
    <article className="flex flex-col gap-3" aria-busy={running}>
      <AnswerTextView
        durationMs={message.durationMs}
        link={links.link}
        running={running}
        steps={message.steps}
        text={message.text}
      />
      {message.cards.length === 0 ? null : (
        // One column, as wide as the answer, in the page and the panel.
        <ul className="grid gap-2">
          {message.cards.map((card, index) => (
            <li
              key={`${card._tag === "post" ? card.postId : card.threadId}-${String(index)}`}
            >
              <ResultCardView card={card} links={links} nameOf={nameOf} />
            </li>
          ))}
        </ul>
      )}
      {message.approvals.map((approval) => (
        <ApprovalCardView
          key={approval.callId}
          approval={approval}
          notDone={message.steps.some(
            (step) =>
              step.callId === approval.callId &&
              (step.state === "refused" || step.state === "failed")
          )}
          busy={busy}
          links={links}
          nameOf={nameOf}
          onAnswer={(approved) => {
            onAnswer(approval.callId, approved);
          }}
        />
      ))}
      {message.outcome === "stopped" ? (
        <p className="text-muted-foreground text-sm">{t("stopped")}</p>
      ) : null}
      {message.outcome === "stepLimit" ? (
        <p className="text-muted-foreground text-sm">{t("stepLimit")}</p>
      ) : null}
      {message.outcome === "failed" && saysFailure ? (
        <p className="text-muted-foreground text-sm">{t("failedHere")}</p>
      ) : null}
      {/* A failure that wrote nothing has nothing to rate or copy. */}
      {running ||
      message.outcome === null ||
      (message.outcome === "failed" && message.text.trim() === "") ? null : (
        <AnswerFoot actions={actions} message={message} />
      )}
    </article>
  );
};

/**
 * What to tell the person about a refused run, in their language: never
 * the server's English `message`.
 */
export const refusalMessage = (
  t: Translate,
  format: Format,
  refusal: RunRefusal
): string =>
  Match.valueTags(refusal, {
    AgentApprovalNotPending: () => t("errors.notPending"),
    AgentBusy: () => t("errors.busy"),
    AgentChatNotFound: () => t("errors.chatNotFound"),
    AssistantInputRejected: ({ maxLength, reason }) =>
      reason === "empty"
        ? t("errors.empty")
        : t("errors.tooLong", { maxLength }),
    AssistantQuotaExceeded: ({ dailyLimit, resetsAt }) =>
      t("errors.quota", {
        dailyLimit,
        resetsAt: format.dateTime(DateTime.toDate(resetsAt), {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      }),
    AssistantUnavailable: () => t("errors.unavailable"),
    Forbidden: ({ reason }) =>
      reason === "personRequired"
        ? t("errors.personRequired")
        : t("errors.forbidden"),
    OwnTextLimitReached: ({ dailyLimit }) =>
      t("errors.ownLimit", { dailyLimit }),
    TextProviderBusy: () => t("errors.ownBusy"),
    Unexpected: () => t("errors.generic"),
    UsageAllowanceReached: ({ allowed, reason, resetsAt }) =>
      Match.value(reason).pipe(
        Match.when("paymentMethodRequired", () => t("errors.paymentMethod")),
        Match.when("paymentFailed", () => t("errors.paymentFailed")),
        Match.orElse(() =>
          t("errors.monthUsed", {
            allowed,
            resetsAt: format.dateTime(DateTime.toDate(resetsAt), {
              dateStyle: "medium",
            }),
          })
        )
      ),
  });

/** What to tell the person about a run that did not answer. */
export const problemMessage = (
  t: Translate,
  format: Format,
  problem: RunProblem
): string =>
  Match.valueTags(problem, {
    failed: ({ reason }) => t("errors.failed", { reason }),
    lost: () => t("errors.lost"),
    refused: ({ refusal }) => refusalMessage(t, format, refusal),
  });

/** The day a chat began on, and its time: "Today 9:51 AM". */
export const DateLine = ({
  at,
  now,
}: {
  readonly at: DateTime.Utc;
  readonly now: DateTime.Utc;
}) => {
  const t = useTranslations("Agent");
  const format = useFormatter();
  const timeZone = useTimeZone() ?? "UTC";
  const date = DateTime.toDate(at);

  return (
    <p className="text-muted-foreground text-center text-xs">
      {t("dateLine", {
        date: format.dateTime(date, { dateStyle: "medium" }),
        day: relativeDayOf(at, now, timeZone),
        time: format.dateTime(date, { timeStyle: "short" }),
      })}
    </p>
  );
};

/**
 * A chat's messages, oldest first, under the day it began, with what came
 * of the last run under them.
 */
export const TranscriptView = ({
  actions,
  links,
  nameOf,
  now,
  onAnswer,
  state,
}: {
  readonly actions: AnswerActions;
  readonly links: ChatLinks;
  readonly nameOf: ChannelNameOf;
  /** The current time, after hydration; null before. */
  readonly now: DateTime.Utc | null;
  readonly onAnswer: (callId: string, approved: boolean) => void;
  readonly state: ChatState;
}) => {
  const t = useTranslations("Agent");
  const format = useFormatter();
  const [first] = state.messages;
  const writing = state.run?.messageId ?? null;

  return (
    <div className="flex flex-col gap-6">
      {first === undefined || now === null ? null : (
        <DateLine at={first.createdAt} now={now} />
      )}
      {state.messages.map((message) => (
        <MessageView
          key={message.id}
          actions={actions}
          busy={state.run !== null}
          links={links}
          message={message}
          nameOf={nameOf}
          onAnswer={onAnswer}
          running={message.id === writing}
          saysFailure={state.problem === null}
        />
      ))}
      {state.run !== null && writing === null ? (
        <p className="text-sm">
          <Shimmer>{t("thinking")}</Shimmer>
        </p>
      ) : null}
      {state.problem === null ? null : (
        <p role="alert" className="text-destructive-text text-sm">
          {problemMessage(t, format, state.problem)}
        </p>
      )}
    </div>
  );
};

/**
 * The composer: Enter sends, Shift+Enter breaks the line, and its round
 * button sends, or stops the run under way.
 */
export const ComposerView = ({
  disabled,
  inputRef,
  label,
  onChange,
  onEscape,
  onSend,
  onStop,
  placeholder,
  running,
  value,
}: {
  readonly disabled: boolean;
  readonly inputRef?: RefObject<HTMLTextAreaElement | null> | undefined;
  readonly label: string;
  readonly onChange: (text: string) => void;
  readonly onEscape?: (() => void) | undefined;
  readonly onSend: () => void;
  readonly onStop: () => void;
  readonly placeholder: string;
  readonly running: boolean;
  readonly value: string;
}) => {
  const t = useTranslations("Agent");
  const empty = value.trim() === "";
  const tooLong = value.length > maxAgentMessageLength;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape" && onEscape !== undefined) {
      event.preventDefault();
      onEscape();
    } else if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();

      if (!running && !empty && !tooLong && !disabled) {
        onSend();
      }
    }
  };

  return (
    <div className="bg-card focus-within:border-ring focus-within:ring-ring/50 flex flex-col gap-2 rounded-xl border p-2 shadow-xs transition-colors focus-within:ring-3">
      <textarea
        ref={inputRef}
        aria-label={label}
        dir="auto"
        disabled={disabled}
        rows={1}
        value={value}
        placeholder={placeholder}
        className="placeholder:text-muted-foreground field-sizing-content max-h-48 min-h-10 w-full resize-none bg-transparent px-2 pt-1.5 text-base outline-none disabled:cursor-not-allowed md:text-sm"
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      <div className="flex items-center justify-end gap-2">
        {/* Near the limit, how much is left; past it, sending waits. */}
        {value.length > maxAgentMessageLength * 0.9 ? (
          <span
            aria-live="polite"
            className={cn(
              "text-xs tabular-nums",
              tooLong ? "text-destructive-text" : "text-muted-foreground"
            )}
          >
            {t("tooLong", {
              count: value.length,
              max: maxAgentMessageLength,
            })}
          </span>
        ) : null}
        {running ? (
          <Button
            size="icon-sm"
            corners="round"
            aria-label={t("stop")}
            onClick={onStop}
          >
            <SquareIcon aria-hidden className="fill-current" />
          </Button>
        ) : (
          <Button
            size="icon-sm"
            corners="round"
            aria-label={t("send")}
            disabled={disabled || empty || tooLong}
            onClick={onSend}
          >
            <ArrowUpIcon aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * Why the agent is off for this person, and what to do: a text provider
 * of the workspace's own, set up in the assistant settings (`settingsHref`
 * for those who may), or a payment method on the billing page.
 */
export const AgentOffView = ({
  billingHref,
  link: AppLink,
  reason,
  settingsHref,
}: {
  readonly billingHref: string | null;
  readonly link: LinkComponent;
  readonly reason: AgentOffReason | null;
  readonly settingsHref: string | null;
}) => {
  const t = useTranslations("Agent");

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <EmptyStateTitle>{t("off.title")}</EmptyStateTitle>
      <p className="text-muted-foreground max-w-md text-sm">
        {reason === "paymentMethod" ? t("off.paymentMethod") : t("off.noModel")}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {reason === "paymentMethod" && billingHref !== null ? (
          <AppLink href={billingHref} className={buttonVariants()}>
            {t("off.billing")}
          </AppLink>
        ) : null}
        {settingsHref === null ? null : (
          <AppLink
            href={settingsHref}
            className={buttonVariants({
              variant: reason === "paymentMethod" ? "outline" : "default",
            })}
          >
            {t("off.settings")}
          </AppLink>
        )}
      </div>
      {settingsHref === null ? (
        <p className="text-muted-foreground max-w-md text-xs">
          {t("off.askAdmin")}
        </p>
      ) : null}
    </div>
  );
};
