"use client";

import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Cause, DateTime, Exit, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import type {
  SocialChannel,
  InboxComment,
  InboxModerationAction,
  InboxPrivateReply,
  InboxReply,
  InboxThreadDetail,
  Platform,
} from "peal-contract";
import { isSocialChannel, forWorkspace } from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "peal-ui/components/alert-dialog";
import { Button } from "peal-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "peal-ui/components/dialog";
import { Skeleton } from "peal-ui/components/skeleton";
import { toast } from "peal-ui/components/toast";
import { useId, useState, useTransition } from "react";
import type { ReactNode } from "react";

import { channelsOf } from "#channels/channels-api.ts";
import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link } from "#i18n/navigation.ts";
import {
  confirmInboxReply,
  confirmPrivateReply,
  inboxChanged,
  inboxThread,
  moderateComment,
  replyToComment,
  sendPrivateReply,
  setCommentAnswered,
  withdrawInboxReply,
} from "#inbox/atoms.ts";
import { commentTargetOf } from "#inbox/comment-target.ts";
import { choiceOnDraft, replyChoice } from "#inbox/composer-choice.ts";
import type { ComposerChoice } from "#inbox/composer-choice.ts";
import { inboxErrorOf } from "#inbox/errors.ts";
import { privateReplyFit } from "#inbox/private-reply-text.ts";
import { replyFit } from "#inbox/reply-text.ts";
import {
  anySending,
  nestComments,
  pendingReplyTo,
  repliesTo,
  withSentReplies,
} from "#inbox/thread-tree.ts";
import { useRefreshWhileVisible } from "#notices/use-refresh-while-visible.ts";

import {
  CommentView,
  isNameless,
  namelessKey,
  handleOf,
  PrivateReplyFormView,
  PrivateReplyView,
  ReplyAbilityNotice,
  ReplyBoxView,
  ReplyView,
  ThreadSummaryView,
  useInboxErrorText,
} from "./inbox-views.tsx";

// How often the thread is read again while a reply is on its way, so the
// page shows how the journal says it ended, and otherwise.
const whileSending = 3000;

const whileIdle = 60_000;

// Whether the thread's channel may answer its comments from Peal.
const repliable = (detail: InboxThreadDetail): boolean =>
  detail.platform !== null && detail.abilities.reply === "available";

const appLink = (href: string, label: string) => (
  <Link href={href} className="underline underline-offset-4">
    {label}
  </Link>
);

/** What the page knows of the thread a comment or a reply belongs to. */
interface ThreadContext {
  readonly detail: InboxThreadDetail;
  /** Whether the reader holds engagement:message: a private reply. */
  readonly mayMessage: boolean;
  /** Whether the reader holds engagement:reply. */
  readonly mayReply: boolean;
  readonly workspaceId: string;
}

// What a member may ask about a comment, besides answering it.
type CommentRequest =
  | { readonly _tag: "answered"; readonly answered: boolean }
  | { readonly _tag: "moderate"; readonly action: InboxModerationAction };

// What the catalogue says once a request about a comment is done.
const doneBy = (request: CommentRequest): string => {
  if (request._tag === "moderate") {
    return request.action;
  }

  return request.answered ? "answered" : "waiting";
};

// The buttons under a comment: whether it still waits for an answer, and
// what its channel's account may do about it on the platform.
const CommentActions = ({
  comment,
  context,
  onReply,
}: {
  readonly comment: InboxComment;
  readonly context: ThreadContext;
  /** Aims the composer at the comment, where it may be answered. */
  readonly onReply?: () => void;
}) => {
  const t = useTranslations("Inbox.action");
  const explain = useInboxErrorText();
  const setAnswered = useAtomSet(setCommentAnswered, { mode: "promiseExit" });
  const moderate = useAtomSet(moderateComment, { mode: "promiseExit" });
  const [isBusy, startRequest] = useTransition();
  const { abilities } = context.detail;

  const ask = (request: CommentRequest) => {
    startRequest(async () => {
      const call = {
        headers: forWorkspace(context.workspaceId),
        params: { commentId: comment.id },
        reactivityKeys: inboxChanged(context.workspaceId, comment.threadId),
      };

      const exit =
        request._tag === "answered"
          ? await setAnswered({
              ...call,
              payload: { answered: request.answered },
            })
          : await moderate({ ...call, payload: { action: request.action } });

      Option.match(inboxErrorOf(exit), {
        onNone: () => {
          toast.success(t("done", { action: doneBy(request) }));
        },
        onSome: (error) => {
          toast.error(explain(error));
        },
      });
    });
  };

  const button = (label: string, request: CommentRequest) => (
    <Button
      variant="ghost"
      size="xs"
      disabled={isBusy}
      focusableWhenDisabled
      onClick={() => {
        ask(request);
      }}
    >
      {label}
    </Button>
  );

  return (
    <>
      {onReply === undefined ? null : (
        <Button variant="ghost" size="xs" onClick={onReply}>
          {t("reply")}
        </Button>
      )}
      {comment.state === "new"
        ? button(t("markAnswered"), { _tag: "answered", answered: true })
        : null}
      {comment.state === "answered"
        ? button(t("markWaiting"), { _tag: "answered", answered: false })
        : null}
      {abilities.like === "available"
        ? button(comment.liked ? t("unlike") : t("like"), {
            _tag: "moderate",
            action: comment.liked ? "unlike" : "like",
          })
        : null}
      {abilities.hide === "available"
        ? button(comment.state === "hidden" ? t("show") : t("hide"), {
            _tag: "moderate",
            action: comment.state === "hidden" ? "unhide" : "hide",
          })
        : null}
      {abilities.delete === "available" ? (
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="ghost"
                size="xs"
                disabled={isBusy}
                focusableWhenDisabled
              />
            }
          >
            {t("delete")}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("deleteDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  ask({ _tag: "moderate", action: "delete" });
                }}
              >
                {t("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
};

// What a member may do about a reply: say what they found for one whose
// outcome is unknown, or take a sent one back from the platform.
const ReplyActions = ({
  context,
  reply,
}: {
  readonly context: ThreadContext;
  readonly reply: InboxReply;
}) => {
  const t = useTranslations("Inbox.reply");
  const tAction = useTranslations("Inbox.action");
  const explain = useInboxErrorText();
  const confirm = useAtomSet(confirmInboxReply, { mode: "promiseExit" });
  const withdraw = useAtomSet(withdrawInboxReply, { mode: "promiseExit" });
  const [isBusy, startRequest] = useTransition();

  const call = {
    headers: forWorkspace(context.workspaceId),
    params: { replyId: reply.id },
    reactivityKeys: inboxChanged(context.workspaceId, reply.threadId),
  };

  const handleConfirm = (sent: boolean) => {
    startRequest(async () => {
      const exit = await confirm({ ...call, payload: { sent } });

      Option.match(inboxErrorOf(exit), {
        onNone: () => {
          toast.success(t("confirmed", { sent: sent ? "true" : "false" }));
        },
        onSome: (error) => {
          toast.error(explain(error));
        },
      });
    });
  };

  const handleWithdraw = () => {
    startRequest(async () => {
      const exit = await withdraw(call);

      Option.match(inboxErrorOf(exit), {
        onNone: () => {
          toast.success(t("withdrawn"));
        },
        onSome: (error) => {
          toast.error(explain(error));
        },
      });
    });
  };

  if (reply.status === "unconfirmed") {
    return (
      <>
        <Button
          variant="ghost"
          size="xs"
          disabled={isBusy}
          focusableWhenDisabled
          onClick={() => {
            handleConfirm(true);
          }}
        >
          {t("confirmSent")}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          disabled={isBusy}
          focusableWhenDisabled
          onClick={() => {
            handleConfirm(false);
          }}
        >
          {t("confirmNotSent")}
        </Button>
      </>
    );
  }

  return reply.status === "sent" &&
    reply.permalink !== null &&
    context.detail.abilities.withdraw === "available" ? (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            disabled={isBusy}
            focusableWhenDisabled
          />
        }
      >
        {isBusy ? t("withdrawing") : t("withdraw")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("withdrawTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("withdrawDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tAction("cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleWithdraw}>
            {t("withdraw")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;
};

// Who a comment's answer goes to: their handle, their name where the
// platform gives no handle, or what the inbox calls someone it has no
// name for.
const useAuthorName = () => {
  const t = useTranslations("Inbox");

  return (comment: InboxComment, platform: Platform): string => {
    const named = comment.author !== null && !isNameless(comment.author);

    const shown =
      comment.author !== null && comment.author.handle === ""
        ? (comment.author.displayName ?? "")
        : comment.author && handleOf(comment.author);

    return named
      ? (shown ?? "")
      : t(`comment.${namelessKey(comment.author, platform)}`);
  };
};

// What a member says they found for a private reply Peal could not
// confirm, in the person's conversation.
const PrivateReplyActions = ({
  context,
  reply,
  threadId,
}: {
  readonly context: ThreadContext;
  readonly reply: InboxPrivateReply;
  readonly threadId: string;
}) => {
  const t = useTranslations("Inbox.privateReply");
  const explain = useInboxErrorText();
  const confirm = useAtomSet(confirmPrivateReply, { mode: "promiseExit" });
  const [isBusy, startRequest] = useTransition();

  const handleConfirm = (went: boolean) => {
    startRequest(async () => {
      const exit = await confirm({
        headers: forWorkspace(context.workspaceId),
        params: { privateReplyId: reply.id },
        payload: { went },
        reactivityKeys: inboxChanged(context.workspaceId, threadId),
      });

      Option.match(inboxErrorOf(exit), {
        onNone: () => {
          toast.success(t("confirmed", { went: went ? "true" : "false" }));
        },
        onSome: (error) => {
          toast.error(explain(error));
        },
      });
    });
  };

  return reply.status === "unconfirmed" ? (
    <>
      <Button
        variant="ghost"
        size="xs"
        disabled={isBusy}
        focusableWhenDisabled
        onClick={() => {
          handleConfirm(true);
        }}
      >
        {t("confirmSent")}
      </Button>
      <Button
        variant="ghost"
        size="xs"
        disabled={isBusy}
        focusableWhenDisabled
        onClick={() => {
          handleConfirm(false);
        }}
      >
        {t("confirmNotSent")}
      </Button>
    </>
  ) : null;
};

// The button that opens the private reply's dialog, and the dialog: one
// message to the comment's author, under an idempotency key kept until
// the server made it, so a lost answer retried sends no second one.
const PrivateReplyAction = ({
  comment,
  context,
  platform,
  until,
}: {
  readonly comment: InboxComment;
  readonly context: ThreadContext;
  readonly platform: Platform;
  readonly until: DateTime.Utc;
}) => {
  const t = useTranslations("Inbox.privateReply");
  const explain = useInboxErrorText();
  const send = useAtomSet(sendPrivateReply, { mode: "promiseExit" });
  const offerUpgrade = useOfferUpgrade();
  const authorName = useAuthorName()(comment, platform);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();

  const handleSend = () => {
    setError(null);
    startSending(async () => {
      const exit = await send({
        headers: {
          ...forWorkspace(context.workspaceId),
          "idempotency-key": key,
        },
        payload: { commentId: comment.id, text },
        reactivityKeys: inboxChanged(context.workspaceId, comment.threadId),
      });

      offerUpgrade(exit);

      if (Exit.isSuccess(exit)) {
        setOpen(false);
        setText("");
        setKey(crypto.randomUUID());
        toast.success(t("sent"));

        return;
      }

      setError(
        inboxErrorOf(exit).pipe(
          Option.map(explain),
          Option.getOrElse(() => explain({ key: "unknown" }))
        )
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="xs" />}>
        {t("open")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <PrivateReplyFormView
          author={authorName}
          error={error}
          fit={privateReplyFit(platform, text)}
          sending={isSending}
          text={text}
          until={until}
          onCancel={() => {
            setOpen(false);
          }}
          onChange={(changed) => {
            // Another text is another message, under a key of its own.
            setText(changed);
            setKey(crypto.randomUUID());
          }}
          onSend={handleSend}
        />
      </DialogContent>
    </Dialog>
  );
};

// What a comment shows of its private reply: the one sent, and, while
// none holds the comment and the platform still takes one, what sends it.
const PrivateReplyPart = ({
  comment,
  context,
}: {
  readonly comment: InboxComment;
  readonly context: ThreadContext;
}) => {
  const { detail, mayMessage } = context;
  const reply = comment.privateReply;
  const until = comment.privateReplyUntil;

  const offered =
    mayMessage &&
    detail.platform !== null &&
    detail.abilities.privateReply === "available" &&
    comment.state !== "deleted" &&
    until !== null &&
    DateTime.isLessThan(DateTime.nowUnsafe(), until) &&
    (reply === null || reply.status === "failed");

  if (reply === null && !offered) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {reply === null ? null : (
        <PrivateReplyView
          reply={reply}
          {...(mayMessage
            ? {
                actions: (
                  <PrivateReplyActions
                    context={context}
                    reply={reply}
                    threadId={comment.threadId}
                  />
                ),
              }
            : {})}
        />
      )}
      {offered && detail.platform !== null && until !== null ? (
        <div className="-ml-2">
          <PrivateReplyAction
            comment={comment}
            context={context}
            platform={detail.platform}
            until={until}
          />
        </div>
      ) : null}
    </div>
  );
};

// The box that answers one comment. What it sends shows at once, as the
// server answered it: on its way.
const ReplyBox = ({
  comment,
  context,
  inputId,
  onDraft,
  onSent,
  pending,
  platform,
}: {
  readonly comment: InboxComment;
  readonly context: ThreadContext;
  readonly inputId: string;
  /** Pins the draft to the comment it answers, until it is emptied. */
  readonly onDraft: (text: string) => void;
  readonly onSent: (reply: InboxReply) => void;
  readonly pending: "sending" | "unconfirmed" | null;
  readonly platform: Platform;
}) => {
  const t = useTranslations("Inbox");
  const explain = useInboxErrorText();
  const send = useAtomSet(replyToComment, { mode: "promiseExit" });
  const offerUpgrade = useOfferUpgrade();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();
  const fit = replyFit(platform, comment.author?.handle ?? null, text);

  const handleSend = () => {
    setError(null);
    startSending(async () => {
      const exit = await send({
        headers: { ...forWorkspace(context.workspaceId) },
        params: { commentId: comment.id },
        payload: { text },
        reactivityKeys: inboxChanged(context.workspaceId, comment.threadId),
      });

      offerUpgrade(exit);

      if (Exit.isSuccess(exit)) {
        onSent(exit.value);
        setText("");
        toast.success(t("box.sent"));

        return;
      }

      setError(
        inboxErrorOf(exit).pipe(
          Option.map(explain),
          Option.getOrElse(() => explain({ key: "unknown" }))
        )
      );
    });
  };

  const authorName = useAuthorName()(comment, platform);

  return (
    <ReplyBoxView
      author={authorName}
      error={error}
      fit={fit}
      inputId={inputId}
      pending={pending}
      sending={isSending}
      text={text}
      onChange={(changed) => {
        setText(changed);
        onDraft(changed);
      }}
      onSend={handleSend}
    />
  );
};

// One comment with everything under it but the comments that answer it,
// which `children` are. The thread's one composer answers it.
const CommentItem = ({
  children,
  comment,
  context,
  onReply,
  replies,
}: {
  readonly children?: ReactNode;
  readonly comment: InboxComment;
  readonly context: ThreadContext;
  /** Aims the composer at this comment. */
  readonly onReply: (comment: InboxComment) => void;
  /** Every reply of the thread, those just sent included. */
  readonly replies: readonly InboxReply[];
}) => {
  const { detail, mayReply } = context;
  const own = repliesTo(replies, comment.id);
  const present = comment.state !== "deleted";
  const answerable = mayReply && present && repliable(detail);

  return (
    <CommentView
      comment={comment}
      platform={detail.platform}
      privateReply={<PrivateReplyPart comment={comment} context={context} />}
      {...(mayReply && present
        ? {
            actions: (
              <CommentActions
                comment={comment}
                context={context}
                {...(answerable
                  ? {
                      onReply: () => {
                        onReply(comment);
                      },
                    }
                  : {})}
              />
            ),
          }
        : {})}
      {...(own.length > 0
        ? {
            replies: own.map((reply) => (
              <ReplyView
                key={reply.id}
                reply={reply}
                {...(mayReply
                  ? {
                      actions: <ReplyActions context={context} reply={reply} />,
                    }
                  : {})}
              />
            )),
          }
        : {})}
    >
      {children}
    </CommentView>
  );
};

const LoadedThread = ({
  channels,
  detail,
  mayMessage,
  mayReply,
  onRefresh,
  workspaceId,
}: {
  readonly channels: readonly SocialChannel[];
  readonly detail: InboxThreadDetail;
  readonly mayMessage: boolean;
  readonly mayReply: boolean;
  readonly onRefresh: () => void;
  readonly workspaceId: string;
}) => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("Inbox");
  const listId = useId();
  const composerId = useId();
  // The comment the composer answers, once a member chose one.
  const [chosen, setChosen] = useState<ComposerChoice | null>(null);
  // The replies this page sent, until the thread lists them itself.
  const [sent, setSent] = useState<readonly InboxReply[]>([]);
  const replies = withSentReplies(detail.replies, sent);

  const context: ThreadContext = {
    detail,
    mayMessage,
    mayReply,
    workspaceId,
  };

  // A private reply on its way is shown as the journal settles it too.
  const privateSending = detail.comments.some(
    ({ privateReply }) => privateReply?.status === "sending"
  );

  useRefreshWhileVisible(
    onRefresh,
    anySending(replies) || privateSending ? whileSending : whileIdle
  );

  const handleSent = (reply: InboxReply) => {
    setSent((before) => [...before, reply]);
    // The draft is gone: the composer moves on to the next comment waiting.
    setChosen(null);
  };

  const handleReply = (comment: InboxComment) => {
    setChosen(replyChoice(comment.id));
    // React's ids hold colons, which a plain `#id` selector cannot.
    globalThis.document
      .querySelector<HTMLTextAreaElement>(`[id="${composerId}"]`)
      ?.focus();
  };

  const target = commentTargetOf(detail.comments, chosen);

  const composer =
    mayReply &&
    target !== undefined &&
    detail.platform !== null &&
    repliable(detail) ? (
      <div className="bg-card sticky bottom-0 mt-auto pt-2">
        <ReplyBox
          comment={target}
          context={context}
          inputId={composerId}
          pending={pendingReplyTo(replies, target.id).pipe(
            Option.map(({ status }) =>
              status === "sending"
                ? ("sending" as const)
                : ("unconfirmed" as const)
            ),
            Option.getOrNull
          )}
          platform={detail.platform}
          onDraft={(text) => {
            setChosen(choiceOnDraft(chosen, target.id, text));
          }}
          onSent={handleSent}
        />
      </div>
    ) : null;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <ThreadSummaryView
        channel={channels.find(({ id }) => id === detail.thread.channelId)}
        link={appLink}
        thread={detail.thread}
        workspaceId={workspaceId}
      />
      {mayReply ? (
        <ReplyAbilityNotice
          channels={appLink(
            workspaceHref(workspaceId, "/channels"),
            t("abilities.channels")
          )}
          disconnected={detail.platform === null}
          standing={detail.abilities.reply}
        />
      ) : (
        <p className="text-muted-foreground text-sm">{t("readOnly")}</p>
      )}
      {mayMessage && detail.abilities.privateReply === "reconnect" ? (
        <p className="text-muted-foreground text-sm">
          {t.rich("privateReply.reconnect", {
            settings: () =>
              appLink(
                workspaceHref(workspaceId, "/inbox"),
                t("privateReply.settings")
              ),
          })}
        </p>
      ) : null}
      <section aria-labelledby={listId} className="flex flex-col gap-4">
        <h3 id={listId} className="sr-only">
          {t("thread.listTitle")}
        </h3>
        {detail.comments.length === 0 ? (
          <p className="text-muted-foreground">{t("thread.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-6">
            {nestComments(detail.comments).map(({ answers, comment }) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                context={context}
                replies={replies}
                onReply={handleReply}
              >
                {answers.length === 0
                  ? undefined
                  : answers.map((answer) => (
                      <CommentItem
                        key={answer.id}
                        comment={answer}
                        context={context}
                        replies={replies}
                        onReply={handleReply}
                      />
                    ))}
              </CommentItem>
            ))}
          </ul>
        )}
      </section>
      {composer}
    </div>
  );
};

/**
 * One thread of the inbox: the comments under a post, the replies sent from
 * Peal, and what the reader may do about each. While a reply is on its way
 * the thread is read again every few seconds, so what shows is always what
 * the server recorded. It renders in the browser, where the reader's time
 * zone is known.
 */
export const ThreadScreen = ({
  mayMessage,
  mayReply,
  threadId,
  workspaceId,
}: {
  /** Whether the reader holds engagement:message: a private reply. */
  readonly mayMessage: boolean;
  /** Whether the reader holds engagement:reply. */
  readonly mayReply: boolean;
  readonly threadId: string;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Inbox");
  const hydrated = useHydrated();
  const query = inboxThread(workspaceId, threadId);
  const result = useAtomValue(query);
  const reload = useAtomRefresh(query);
  const channels = useAtomValue(channelsOf(workspaceId));

  if (!hydrated || AsyncResult.isInitial(result)) {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <span className="sr-only">{t("loading")}</span>
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (AsyncResult.isFailure(result)) {
    const missing = Cause.findErrorOption(result.cause).pipe(
      Option.exists(({ _tag }) => _tag === "InboxThreadNotFound")
    );

    return missing ? (
      <p className="text-muted-foreground">{t("thread.notFound")}</p>
    ) : (
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
    <LoadedThread
      channels={
        AsyncResult.isSuccess(channels)
          ? channels.value.filter(isSocialChannel)
          : []
      }
      detail={result.value}
      mayMessage={mayMessage}
      mayReply={mayReply}
      workspaceId={workspaceId}
      onRefresh={reload}
    />
  );
};
