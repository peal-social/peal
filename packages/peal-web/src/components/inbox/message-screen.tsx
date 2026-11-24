"use client";

import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { DateTime, Exit, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  isSocialChannel,
  maxInboxMessageLength,
  forWorkspace,
} from "peal-contract";
import type {
  InboxConversationDetail,
  InboxOutgoingMessage,
  SocialChannel,
} from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import { Skeleton } from "peal-ui/components/skeleton";
import { toast } from "peal-ui/components/toast";
import { useId, useState, useTransition } from "react";

import { channelsOf } from "#channels/channels-api.ts";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link } from "#i18n/navigation.ts";
import { answerWindowOf } from "#inbox/answer-window.ts";
import { inboxErrorOf } from "#inbox/errors.ts";
import { inboxStateOf, withInboxQuery } from "#inbox/inbox-query.ts";
import {
  confirmMessage,
  conversationDetail,
  conversationsChanged,
  sendMessage,
  setConversationRead,
} from "#inbox/message-atoms.ts";
import { useRefreshWhileVisible } from "#notices/use-refresh-while-visible.ts";

import { useInboxErrorText } from "./inbox-views.tsx";
import {
  ConfirmMessageView,
  ConversationSummaryView,
  DirectMessageView,
  MessageBoxView,
  OutgoingMessageView,
  ReplyWindowView,
} from "./message-views.tsx";

// How often the conversation is read again while the tab is visible, so a
// message on its way shows how it ended.
const refreshEvery = 30_000;

// Whether a message to the conversation is on its way, or may be out.
const isPending = (sent: readonly InboxOutgoingMessage[]) =>
  sent.some(({ status }) => status === "sending" || status === "unconfirmed");

// What a member who may answer can do about a conversation.
const useActions = (workspaceId: string, conversationId: string) => {
  const explain = useInboxErrorText();
  const [error, setError] = useState<string | null>(null);

  const failed = <A, E extends { readonly _tag: string }>(
    exit: Exit.Exit<A, E>
  ) => {
    setError(
      inboxErrorOf(exit).pipe(
        Option.map(explain),
        Option.getOrElse(() => explain({ key: "unknown" }))
      )
    );
  };

  return {
    error,
    failed,
    reactivityKeys: conversationsChanged(workspaceId, conversationId),
    setError,
  };
};

// The links between a conversation's pages, above its messages (oldest
// first): to older messages while some are left, and back to the latest
// from an older page. Each keeps the inbox list's query, so the list
// beside the conversation stays as it was.
const PagesView = ({
  cursor,
  href,
  nextCursor,
}: {
  readonly cursor: string;
  /** The conversation's own address, without a query. */
  readonly href: string;
  readonly nextCursor: string | null;
}) => {
  const t = useTranslations("InboxMessages.thread");
  const list = inboxStateOf(useSearchParams());

  return nextCursor === null && cursor === "" ? null : (
    <nav className="flex flex-wrap gap-4 text-xs">
      {nextCursor === null ? null : (
        <Link
          href={withInboxQuery(href, list, { cursor: nextCursor })}
          className="underline underline-offset-4"
        >
          {t("older")}
        </Link>
      )}
      {cursor === "" ? null : (
        <Link
          href={withInboxQuery(href, list)}
          className="underline underline-offset-4"
        >
          {t("latest")}
        </Link>
      )}
    </nav>
  );
};

const LoadedConversation = ({
  byHand,
  channels,
  cursor,
  detail,
  mayAnswer,
  workspaceId,
}: {
  /** The member's own session, not staff acting as them. */
  readonly byHand: boolean;
  readonly channels: readonly SocialChannel[];
  readonly cursor: string;
  readonly detail: InboxConversationDetail;
  readonly mayAnswer: boolean;
  readonly workspaceId: string;
}) => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("InboxMessages");
  const listId = useId();
  const { conversation } = detail;

  const { error, failed, reactivityKeys, setError } = useActions(
    workspaceId,
    conversation.id
  );

  const send = useAtomSet(sendMessage, { mode: "promiseExit" });
  const mark = useAtomSet(setConversationRead, { mode: "promiseExit" });
  const confirm = useAtomSet(confirmMessage, { mode: "promiseExit" });
  const [text, setText] = useState("");
  const [attempt, setAttempt] = useState(() => crypto.randomUUID());
  const [isSending, startSending] = useTransition();
  const [isActing, startActing] = useTransition();

  const params = { conversationId: conversation.id };
  const headers = forWorkspace(workspaceId);

  // Past Meta's 24 hours, a member answering by hand has until
  // `personClosesAt`, where the server's Meta app holds the Human Agent
  // feature: only in their own session, never staff acting as them.
  const window = answerWindowOf(detail.window, byHand, DateTime.nowUnsafe());

  const answers =
    mayAnswer && detail.abilities.send === "available" && window.answers;

  const handleSend = () => {
    setError(null);
    startSending(async () => {
      // The same key until the message is made: one sent again after a
      // lost answer is the one the first request made.
      const exit = await send({
        headers: { ...headers, "idempotency-key": attempt },
        params,
        payload: { text },
        reactivityKeys,
      });

      if (Exit.isSuccess(exit)) {
        setAttempt(crypto.randomUUID());
        setText("");
        toast.success(t("box.sentToast"));

        return;
      }

      failed(exit);
    });
  };

  const handleMark = () => {
    setError(null);
    startActing(async () => {
      const exit = await mark({
        params,
        headers,
        payload: { read: conversation.unread },
        reactivityKeys,
      });

      if (Exit.isFailure(exit)) {
        failed(exit);
      }
    });
  };

  const handleConfirm = (messageId: string, sent: boolean) => {
    setError(null);
    startActing(async () => {
      const exit = await confirm({
        headers: forWorkspace(workspaceId),
        params: { messageId },
        payload: { sent },
        reactivityKeys,
      });

      if (Exit.isFailure(exit)) {
        failed(exit);
      }
    });
  };

  const mayWrite = mayAnswer && detail.abilities.send === "available";

  const unsettled = detail.sent.filter(({ status }) => status !== "sent");

  return (
    <div className="flex flex-1 flex-col gap-5">
      <ConversationSummaryView
        channel={channels.find(({ id }) => id === conversation.channelId)}
        conversation={conversation}
        {...(mayAnswer
          ? {
              actions: (
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={isActing}
                  focusableWhenDisabled
                  onClick={handleMark}
                >
                  {conversation.unread
                    ? t("thread.markRead")
                    : t("thread.markUnread")}
                </Button>
              ),
            }
          : {})}
      />
      {mayAnswer ? null : (
        <p className="text-muted-foreground text-sm">{t("thread.readOnly")}</p>
      )}
      <section aria-labelledby={listId} className="flex flex-col gap-4">
        <h3 id={listId} className="sr-only">
          {t("thread.title")}
        </h3>
        <PagesView
          cursor={cursor}
          href={workspaceHref(
            workspaceId,
            `/inbox/messages/${conversation.id}`
          )}
          nextCursor={detail.nextCursor}
        />
        <ul className="flex flex-col gap-6">
          {detail.messages.map((message) => (
            <DirectMessageView
              key={message.id}
              conversation={conversation}
              message={message}
            />
          ))}
        </ul>
        {unsettled.length === 0 ? null : (
          <ul className="flex flex-col gap-3">
            {unsettled.map((message) => (
              <OutgoingMessageView
                key={message.id}
                message={message}
                {...(mayAnswer && message.status === "unconfirmed"
                  ? {
                      actions: (
                        <ConfirmMessageView
                          disabled={isActing}
                          onConfirm={(sent) => {
                            handleConfirm(message.id, sent);
                          }}
                        />
                      ),
                    }
                  : {})}
              />
            ))}
          </ul>
        )}
      </section>
      {mayWrite || error !== null ? (
        <div className="bg-card sticky bottom-0 mt-auto flex flex-col gap-2 pt-2">
          {conversation.request && answers ? (
            <p className="text-muted-foreground text-xs">
              {t("thread.request")}
            </p>
          ) : null}
          {mayWrite ? (
            <ReplyWindowView
              personOpen={window.personOpen}
              window={window.shown}
            />
          ) : null}
          {answers ? (
            <MessageBoxView
              error={error}
              maximum={maxInboxMessageLength}
              pending={isPending(detail.sent)}
              sending={isSending}
              text={text}
              onChange={(changed) => {
                // Another text is another message, under a key of its own.
                setText(changed);
                setAttempt(crypto.randomUUID());
              }}
              onSend={handleSend}
            />
          ) : null}
          {!answers && error !== null ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

/**
 * A conversation whole, as one: a summary, its messages oldest first,
 * those sent from Peal and how each ended, and, for a member who may
 * answer and where the channel can, one composer at the pane's foot. Rendered in the browser, where the reader's time zone
 * is known. `cursor` shows the page of older messages it names.
 */
export const MessageScreen = ({
  byHand,
  conversationId,
  cursor,
  mayAnswer,
  workspaceId,
}: {
  /** The member's own session, not staff acting as them. */
  readonly byHand: boolean;
  readonly conversationId: string;
  readonly cursor: string;
  readonly mayAnswer: boolean;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("InboxMessages");
  const hydrated = useHydrated();
  const atom = conversationDetail(workspaceId, conversationId, cursor);
  const result = useAtomValue(atom);
  const reload = useAtomRefresh(atom);
  const channels = useAtomValue(channelsOf(workspaceId));

  useRefreshWhileVisible(reload, refreshEvery);

  if (!hydrated || AsyncResult.isInitial(result)) {
    return <Skeleton className="h-48" />;
  }

  if (AsyncResult.isFailure(result)) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <span className="flex flex-wrap items-center justify-between gap-2">
            {t("loadFailed")}
            <Button variant="outline" size="sm" onClick={reload}>
              {t("retry")}
            </Button>
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <LoadedConversation
      byHand={byHand}
      channels={
        AsyncResult.isSuccess(channels)
          ? channels.value.filter(isSocialChannel)
          : []
      }
      cursor={cursor}
      detail={result.value}
      mayAnswer={mayAnswer}
      workspaceId={workspaceId}
    />
  );
};
