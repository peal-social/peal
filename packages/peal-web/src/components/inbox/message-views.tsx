"use client";

import { DateTime } from "effect";
import { useFormatter, useTranslations } from "next-intl";
import type {
  InboxConversation,
  InboxConversationDetail,
  InboxDirectMessage,
  InboxOutgoingMessage,
} from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import { Label } from "peal-ui/components/label";
import { Textarea } from "peal-ui/components/textarea";
import { useId } from "react";
import type { ChangeEvent, ReactNode, SubmitEvent } from "react";

// The views of the inbox's direct messages: a conversation's row, a
// message, one sent from Peal and the box to answer in, whatever fetched
// them. Their state lives in messages-list.tsx and message-screen.tsx.
// What people wrote is shown as text, never as markup: React escapes it.

const useInstant = () => {
  const format = useFormatter();

  return (at: DateTime.Utc) =>
    format.dateTime(DateTime.toDate(at), {
      dateStyle: "medium",
      timeStyle: "short",
    });
};

/** One message, as its platform gave it: who sent it, when, and its text. */
export const DirectMessageView = ({
  conversation,
  message,
}: {
  readonly conversation: InboxConversation;
  readonly message: InboxDirectMessage;
}) => {
  const t = useTranslations("InboxMessages.message");
  const instant = useInstant();

  const sender = conversation.participants.find(
    ({ platformId }) => platformId === message.senderPlatformId
  );

  return (
    <li
      className={
        message.fromAccount
          ? "bg-muted ml-8 flex flex-col gap-1 rounded-md px-3 py-2"
          : "mr-8 flex flex-col gap-1 rounded-md border px-3 py-2"
      }
    >
      <span className="text-muted-foreground text-xs">
        {message.fromAccount
          ? t("account")
          : (sender?.displayName ?? sender?.handle ?? t("them"))}{" "}
        · {instant(message.sentAt)}
        {message.attachments > 0
          ? ` · ${t("files", { count: message.attachments })}`
          : ""}
      </span>
      <p dir="auto" className="text-sm whitespace-pre-line">
        {message.text === "" ? t("noText") : message.text}
      </p>
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

  if (window.closesAt === null) {
    return window.open ? null : (
      <p className="text-muted-foreground text-sm">{t("closed")}</p>
    );
  }

  const byHand = window.personClosesAt;

  if (window.open) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("openUntil", { at: instant(window.closesAt) })}
        {byHand === null
          ? null
          : ` ${t("personAfter", { at: instant(byHand) })}`}
      </p>
    );
  }

  if (byHand === null) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("windowClosed", { at: instant(window.closesAt) })}
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-sm">
      {personOpen
        ? t("personOpenUntil", { at: instant(byHand) })
        : t("personWindowClosed", { at: instant(byHand) })}
    </p>
  );
};

/** A message sent from Peal, how it ended, and what a member may do about it. */
export const OutgoingMessageView = ({
  actions,
  message,
}: {
  /** What the member may do, already wired; none otherwise. */
  readonly actions: ReactNode;
  readonly message: InboxOutgoingMessage;
}) => {
  const t = useTranslations("InboxMessages.message");

  return (
    <li className="flex flex-col gap-2">
      <p className="text-muted-foreground text-sm">
        {t("sent", { status: message.status })}
      </p>
      {actions}
    </li>
  );
};

/** The buttons that settle a message Peal could not confirm. */
export const ConfirmMessageView = ({
  disabled,
  onConfirm,
}: {
  readonly disabled: boolean;
  readonly onConfirm: (sent: boolean) => void;
}) => {
  const t = useTranslations("InboxMessages.message");

  return (
    <span className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => {
          onConfirm(true);
        }}
      >
        {t("confirmSent")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => {
          onConfirm(false);
        }}
      >
        {t("confirmNotSent")}
      </Button>
    </span>
  );
};

/** The box a member answers a conversation in. */
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
  const empty = text.trim() === "";

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
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
