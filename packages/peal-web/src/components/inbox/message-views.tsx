"use client";

import { DateTime } from "effect";
import { useFormatter, useTranslations } from "next-intl";
import type {
  InboxConversation,
  InboxConversationDetail,
  InboxDirectMessage,
  InboxOutgoingMessage,
  SocialChannel,
} from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Avatar, AvatarFallback } from "peal-ui/components/avatar";
import { Button } from "peal-ui/components/button";
import { Label } from "peal-ui/components/label";
import { Textarea } from "peal-ui/components/textarea";
import { useId } from "react";
import type { ChangeEvent, ReactNode, SubmitEvent } from "react";

import { initialOfName, useChannelName } from "./inbox-views.tsx";

// The views of the inbox's direct messages: a conversation's summary, a
// message, one sent from Peal and the box to answer in, whatever fetched
// them. Their state lives in inbox-list.tsx and message-screen.tsx. A
// conversation reads as one (DESIGN.md, "split-thread"): each message
// flat, oldest first, one composer at the pane's foot. What people wrote
// is shown as text, never as markup: React escapes it.

const useInstant = () => {
  const format = useFormatter();

  return (at: DateTime.Utc) =>
    format.dateTime(DateTime.toDate(at), {
      dateStyle: "medium",
      timeStyle: "short",
    });
};

/**
 * A conversation's heading on its own page: who is in it, on which
 * channel, whether someone wrote since a member last read it, that its
 * messages are private, and the ways out (`actions`, quiet buttons).
 */
export const ConversationSummaryView = ({
  actions,
  channel,
  conversation,
}: {
  readonly actions?: ReactNode;
  /** The conversation's channel, unless it was disconnected since. */
  readonly channel: SocialChannel | undefined;
  readonly conversation: InboxConversation;
}) => {
  const t = useTranslations("InboxMessages");
  const channelName = useChannelName();

  const people = conversation.participants
    .map(({ displayName, handle }) => displayName ?? handle)
    .join(", ");

  return (
    <div className="flex flex-col gap-2 border-b pb-4">
      <p className="text-sm">
        <bdi>{t("row.with", { people })}</bdi>
      </p>
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          {conversation.unread ? (
            <span aria-hidden className="bg-brand size-1.5 rounded-full" />
          ) : null}
          {conversation.unread ? t("row.unread") : t("row.read")}
        </span>
        <span>{channelName(channel)}</span>
        <span className="tabular-nums">
          {t("row.count", { count: conversation.messages })}
        </span>
      </p>
      <p className="text-muted-foreground text-xs">{t("thread.private")}</p>
      {actions === undefined ? null : (
        <div className="-ml-2 flex flex-wrap items-center gap-1">{actions}</div>
      )}
    </div>
  );
};

/**
 * One message, flat, as its platform gave it: who sent it, a muted line
 * with when and how many files it holds (never the files), and its text.
 */
export const DirectMessageView = ({
  conversation,
  message,
}: {
  readonly conversation: InboxConversation;
  readonly message: InboxDirectMessage;
}) => {
  const t = useTranslations("InboxMessages.message");
  const instant = useInstant();

  const sender = message.fromAccount
    ? undefined
    : conversation.participants.find(
        ({ platformId }) => platformId === message.senderPlatformId
      );

  const name = message.fromAccount
    ? t("account")
    : (sender?.displayName ?? sender?.handle ?? t("them"));

  const handle =
    sender === undefined ||
    sender.handle === "" ||
    sender.displayName === null ||
    sender.displayName === ""
      ? null
      : sender.handle;

  return (
    <li className="flex gap-3">
      <Avatar size="sm">
        <AvatarFallback>
          {message.fromAccount || sender !== undefined
            ? initialOfName(name)
            : "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <bdi className="font-medium break-words">{name}</bdi>
          {handle === null ? null : (
            <bdi className="text-muted-foreground text-sm break-all">
              {handle}
            </bdi>
          )}
          <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
            <span>{instant(message.sentAt)}</span>
            {message.attachments > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>{t("files", { count: message.attachments })}</span>
              </>
            ) : null}
          </span>
        </div>
        <p dir="auto" className="text-sm break-words whitespace-pre-wrap">
          {message.text === "" ? t("noText") : message.text}
        </p>
      </div>
    </li>
  );
};

/**
 * Until when the platform takes an answer, where it says (Messenger's and
 * Instagram's 24 hours), or why it takes none: its time ended, or nobody
 * else wrote yet, as Peal never writes first. Where the server's Meta app
 * holds Meta's Human Agent feature (`personClosesAt`), a member answering
 * by hand has until 7 days after the person's last message:
 * `personOpen` says whether that time is still running.
 */
export const ReplyWindowView = ({
  personOpen = false,
  window,
}: {
  readonly personOpen?: boolean;
  readonly window: InboxConversationDetail["window"];
}) => {
  const t = useTranslations("InboxMessages.box");
  const instant = useInstant();
  const className = "text-muted-foreground text-xs";

  if (window.closesAt === null) {
    return window.open ? null : <p className={className}>{t("closed")}</p>;
  }

  const byHand = window.personClosesAt;

  if (window.open) {
    return (
      <p className={className}>
        {t("openUntil", { at: instant(window.closesAt) })}
        {byHand === null
          ? null
          : ` ${t("personAfter", { at: instant(byHand) })}`}
      </p>
    );
  }

  if (byHand === null) {
    return (
      <p className={className}>
        {t("windowClosed", { at: instant(window.closesAt) })}
      </p>
    );
  }

  return (
    <p className={className}>
      {personOpen
        ? t("personOpenUntil", { at: instant(byHand) })
        : t("personWindowClosed", { at: instant(byHand) })}
    </p>
  );
};

/**
 * A message sent from Peal that is not in the conversation yet, behind a
 * line at its start: when, how it ended, its text, and what a member may
 * do about it (`actions`).
 */
export const OutgoingMessageView = ({
  actions,
  message,
}: {
  /** What the member may do, already wired; none otherwise. */
  readonly actions?: ReactNode;
  readonly message: InboxOutgoingMessage;
}) => {
  const t = useTranslations("InboxMessages.message");
  const instant = useInstant();

  const troubled =
    message.status === "failed" || message.status === "unconfirmed";

  return (
    <li className="flex flex-col gap-1 border-l-2 pl-3">
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span>{t("from", { at: instant(message.createdAt) })}</span>
        <span aria-hidden>·</span>
        <span className={troubled ? "text-destructive font-medium" : undefined}>
          {t("sent", { status: message.status })}
        </span>
      </p>
      <p dir="auto" className="text-sm break-words whitespace-pre-wrap">
        {message.text}
      </p>
      {actions === undefined || actions === null ? null : (
        <div className="-ml-2 flex flex-wrap gap-1 empty:hidden">{actions}</div>
      )}
    </li>
  );
};

/** The quiet buttons that settle a message Peal could not confirm. */
export const ConfirmMessageView = ({
  disabled,
  onConfirm,
}: {
  readonly disabled: boolean;
  readonly onConfirm: (sent: boolean) => void;
}) => {
  const t = useTranslations("InboxMessages.message");

  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        disabled={disabled}
        focusableWhenDisabled
        onClick={() => {
          onConfirm(true);
        }}
      >
        {t("confirmSent")}
      </Button>
      <Button
        variant="ghost"
        size="xs"
        disabled={disabled}
        focusableWhenDisabled
        onClick={() => {
          onConfirm(false);
        }}
      >
        {t("confirmNotSent")}
      </Button>
    </>
  );
};

/** The conversation's one composer, at the pane's foot. */
export const MessageBoxView = ({
  error,
  maximum,
  onChange,
  onSend,
  pending,
  sending,
  text,
}: {
  /** Why the last send failed, already written. */
  readonly error: string | null;
  readonly maximum: number;
  readonly onChange: (text: string) => void;
  readonly onSend: () => void;
  /** Whether a message to the conversation is on its way. */
  readonly pending: boolean;
  readonly sending: boolean;
  readonly text: string;
}) => {
  const t = useTranslations("InboxMessages.box");
  const id = useId();
  const hintId = useId();
  const countId = useId();
  // Counted as the server counts the most a member may write.
  const written = text.trim();
  const tooLong = written.length > maximum;
  const empty = written === "";

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card flex flex-col gap-2 rounded-lg border p-3 shadow-sm"
    >
      <Label htmlFor={id}>{t("label")}</Label>
      <Textarea
        dir="auto"
        id={id}
        value={text}
        disabled={pending || sending}
        aria-invalid={tooLong}
        aria-describedby={`${hintId} ${countId}`}
        onChange={handleChange}
      />
      <span id={hintId} className="text-muted-foreground text-xs">
        {t("private")}
      </span>
      {error === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {pending ? <output className="text-sm">{t("pending")}</output> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          id={countId}
          aria-live="polite"
          className={
            tooLong
              ? "text-destructive text-sm"
              : "text-muted-foreground text-sm"
          }
        >
          {t("count", { length: written.length, maximum })}
        </span>
        <Button
          type="submit"
          size="sm"
          disabled={pending || sending || empty || tooLong}
          focusableWhenDisabled
        >
          {sending ? t("sending") : t("send")}
        </Button>
      </div>
    </form>
  );
};
