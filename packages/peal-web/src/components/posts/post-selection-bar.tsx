"use client";

import { useAtomSet } from "@effect/atom-react";
import { useShortcut, useShortcutHint } from "@ui-sdk/react/shortcuts";
import { Exit } from "effect";
import {
  BanIcon,
  CheckIcon,
  CommandIcon,
  MessageSquareIcon,
  TagIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { Permission, Post, Tag } from "peal-contract";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "peal-ui/components/alert-dialog";
import {
  SelectionBar,
  SelectionBarAction,
  SelectionBarClear,
  SelectionCount,
} from "peal-ui/components/selection-bar";
import { TagDot } from "peal-ui/components/tag";
import { toast } from "peal-ui/components/toast";
import { useState } from "react";

import { RequestChangesDialog } from "#components/review/request-changes-dialog.tsx";
import { usePostDecisions } from "#components/review/use-post-decisions.ts";
import type { DecisionOutcome } from "#components/review/use-post-decisions.ts";
import {
  useOpenCommandMenu,
  usePageCommands,
} from "#components/shell/command-scope.tsx";
import type { PageCommand } from "#components/shell/command-scope.tsx";
import { useOfferUndo } from "#components/undo.tsx";
import { cancelPost, postsKeys, unschedulePost } from "#posts/api.ts";
import {
  mayCancel,
  mayUnschedule,
  tagStateOf,
  withoutTag,
  withTag,
} from "#posts/bulk.ts";
import { commandMenuKey, selectionKeys } from "#shell/keys.ts";
import { tagPost } from "#tags/atoms.ts";

// The keys that act on the chosen posts, as in the command menu.
const addTagKey = selectionKeys.tag;

const {
  approve: approveKey,
  backToDraft: backToDraftKey,
  cancel: cancelKey,
  requestChanges: requestChangesKey,
} = selectionKeys;

// The command "Add tag…" opens on its page of tags.
const addTagCommand = "selection-tag";

type Outcome = "done" | "failed";

// One request after the other: a mutation atom runs one call at a time,
// and a second call interrupts the first. Decisions also wait for those
// the list's rows take (`usePostDecisions`).
const inTurn = async <A, B>(
  items: readonly A[],
  run: (item: A) => Promise<B>
): Promise<readonly B[]> => {
  const [first, ...rest] = items;

  return first === undefined
    ? []
    : [await run(first), ...(await inTurn(rest, run))];
};

// Runs one request a post, in turn, and counts how they ended.
const eachOf = async (
  posts: readonly Post[],
  run: (post: Post) => Promise<Outcome>
): Promise<{ readonly done: number; readonly failed: number }> => {
  const outcomes = await inTurn(posts, run);

  return {
    done: outcomes.filter((outcome) => outcome === "done").length,
    failed: outcomes.filter((outcome) => outcome === "failed").length,
  };
};

/**
 * What acts on the posts chosen in the list (DESIGN.md, "Choosing
 * several"): the pill with the count, **Actions** and a way to let go, and
 * the actions as commands of the command menu on the choice, each with its
 * key: file them under a tag (L), approve those that wait (V) or request
 * changes on them (R), take them back to draft (U), or cancel them (⇧⌫).
 * Each names how many of the chosen posts it reaches, and is left out
 * where the member's role or the posts' states allow none.
 */
export const PostSelectionBar = ({
  onClear,
  permissions,
  posts,
  tags,
  workspaceId,
}: {
  readonly onClear: () => void;
  readonly permissions: readonly Permission[];
  /** The posts chosen, in the list's order. */
  readonly posts: readonly Post[];
  readonly tags: readonly Tag[];
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Posts.Selection");
  const file = useAtomSet(tagPost, { mode: "promiseExit" });
  const unschedule = useAtomSet(unschedulePost, { mode: "promiseExit" });
  const cancel = useAtomSet(cancelPost, { mode: "promiseExit" });
  const offerUndo = useOfferUndo();
  const openMenu = useOpenCommandMenu();
  const menuHint = useShortcutHint(commandMenuKey);
  const [confirming, setConfirming] = useState(false);
  const [approving, setApproving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const decide = usePostDecisions();

  const mayTag = permissions.includes("post:update") && tags.length > 0;
  const maySchedule = permissions.includes("post:schedule");
  const unschedulable = maySchedule ? posts.filter(mayUnschedule) : [];
  const cancellable = maySchedule ? posts.filter(mayCancel) : [];

  const decidable = permissions.includes("post:approve")
    ? decide.decisionsOf(posts)
    : [];

  const sayHowItWent = (
    { done, failed }: { readonly done: number; readonly failed: number },
    action: "cancelled" | "tagged" | "unscheduled"
  ) => {
    if (failed === 0) {
      toast.success(t(`done.${action}`, { count: done }));
    } else {
      toast.error(t("partly", { done, failed }));
    }
  };

  const setTags = async (post: Post, tagIds: readonly string[]) =>
    Exit.isSuccess(
      await file({
        params: { postId: post.id, workspaceId },
        payload: { tagIds: [...tagIds] },
        reactivityKeys: postsKeys,
      })
    );

  // Changes the chosen posts' tags as `next` says for each (null: this one
  // stays), then offers Undo, which puts back each post's own tags.
  const changeTags = async ({
    done,
    retag,
    nothing,
    undone,
  }: {
    readonly done: (count: number) => string;
    readonly retag: (tagIds: readonly string[]) => readonly string[] | null;
    readonly nothing: string;
    readonly undone: (count: number) => string;
  }) => {
    const changed = posts.flatMap((post) => {
      const tagIds = retag(post.tagIds);

      return tagIds === null
        ? []
        : [{ before: post.tagIds, next: tagIds, post }];
    });

    if (changed.length === 0) {
      toast.info(nothing);

      return;
    }

    setBusy(true);

    const outcome = await eachOf(
      changed.map(({ post }) => post),
      async (post) => {
        const tagIds =
          changed.find((change) => change.post.id === post.id)?.next ?? [];

        return (await setTags(post, tagIds)) ? "done" : "failed";
      }
    );

    setBusy(false);

    if (outcome.failed > 0) {
      toast.error(t("partly", outcome));

      return;
    }

    offerUndo({
      message: done(outcome.done),
      undo: async () => {
        const back = await eachOf(
          changed.map(({ post }) => post),
          async (post) => {
            const before =
              changed.find((change) => change.post.id === post.id)?.before ??
              [];

            return (await setTags(post, before)) ? "done" : "failed";
          }
        );

        if (back.failed === 0) {
          toast.success(undone(back.done));
        } else {
          toast.error(t("partly", back));
        }
      },
    });
  };

  // A tag every chosen post has comes off them all; any other goes on
  // those without it, as a checkbox would.
  const toggleTag = async (tag: Tag) => {
    await (tagStateOf(posts, tag.id) === "all"
      ? changeTags({
          done: (count) => t("done.untagged", { count, tag: tag.name }),
          retag: (tagIds) => withoutTag(tagIds, tag.id),
          nothing: t("notTagged", { tag: tag.name }),
          undone: (count) => t("retagged", { count, tag: tag.name }),
        })
      : changeTags({
          done: (count) => t("done.tagged", { count, tag: tag.name }),
          retag: (tagIds) => withTag(tagIds, tag.id),
          nothing: t("alreadyTagged", { tag: tag.name }),
          undone: (count) => t("untagged", { count, tag: tag.name }),
        }));
  };

  const removeAllTags = async () => {
    await changeTags({
      done: (count) => t("done.allUntagged", { count }),
      retag: (tagIds) => (tagIds.length === 0 ? null : []),
      nothing: t("noTags"),
      undone: (count) => t("tagsBack", { count }),
    });
  };

  const backToDraft = async () => {
    setBusy(true);

    const outcome = await eachOf(unschedulable, async (post) =>
      Exit.isSuccess(
        await unschedule({
          params: { postId: post.id, workspaceId },
          reactivityKeys: postsKeys,
        })
      )
        ? "done"
        : "failed"
    );

    setBusy(false);
    sayHowItWent(outcome, "unscheduled");
  };

  const cancelAll = async () => {
    setBusy(true);

    const outcome = await eachOf(cancellable, async (post) =>
      Exit.isSuccess(
        await cancel({
          params: { postId: post.id, workspaceId },
          reactivityKeys: postsKeys,
        })
      )
        ? "done"
        : "failed"
    );

    setBusy(false);
    setConfirming(false);
    sayHowItWent(outcome, "cancelled");
  };

  const askToCancel = () => {
    setConfirming(true);
  };

  // Decides on each post that waits, in turn, and counts how they ended.
  const decideEach = async (
    run: (decision: (typeof decidable)[number]) => Promise<DecisionOutcome>
  ) => {
    const outcomes = await inTurn(decidable, run);

    return {
      done: outcomes.filter(({ kind }) => kind !== "refused").length,
      failed: outcomes.filter(({ kind }) => kind === "refused").length,
      late: outcomes.filter(
        (outcome) => outcome.kind === "approved" && outcome.late
      ).length,
    };
  };

  const approveAll = async () => {
    setBusy(true);

    const { done, failed, late } = await decideEach(decide.approve);

    setBusy(false);
    setApproving(false);

    if (failed > 0) {
      toast.error(t("partly", { done, failed }));
    } else if (late > 0) {
      toast.success(t("done.approvedLate", { count: done, late }));
    } else {
      toast.success(t("done.approved", { count: done }));
    }
  };

  const requestChangesOnAll = async (comment: string) => {
    setBusy(true);

    const outcome = await decideEach(async (decision) => {
      const decided = await decide.requestChanges(decision, comment);

      return decided;
    });

    setBusy(false);

    if (outcome.failed > 0) {
      toast.error(t("partly", outcome));

      return outcome.done > 0;
    }

    setAsking(false);
    toast.success(t("done.changesRequested", { count: outcome.done }));

    return true;
  };

  const askToApprove = () => {
    setApproving(true);
  };

  const askForChanges = () => {
    setAsking(true);
  };

  // The actions, as commands of the menu on the choice, each with its key.
  const commands: PageCommand[] = [
    ...(mayTag
      ? [
          {
            choose: {
              options: [
                ...(posts.some(({ tagIds }) => tagIds.length > 0)
                  ? [
                      {
                        id: "remove-all",
                        label: t("removeAllTags"),
                        mark: <XIcon aria-hidden />,
                        run: removeAllTags,
                      },
                    ]
                  : []),
                ...tags.map((tag) => {
                  const state = tagStateOf(posts, tag.id);

                  return {
                    checked:
                      state === "some" ? ("mixed" as const) : state === "all",
                    id: tag.id,
                    label: tag.name,
                    mark: <TagDot colour={tag.colour} />,
                    run: async () => {
                      await toggleTag(tag);
                    },
                  };
                }),
              ],
              placeholder: t("tagPlaceholder"),
            },
            icon: TagIcon,
            id: addTagCommand,
            keys: addTagKey,
            label: t("addTag"),
          },
        ]
      : []),
    ...(decidable.length === 0
      ? []
      : [
          {
            icon: CheckIcon,
            id: "selection-approve",
            keys: approveKey,
            label: t("approve", {
              count: decidable.length,
              partial: decidable.length < posts.length ? "yes" : "no",
              total: posts.length,
            }),
            run: askToApprove,
          },
          {
            icon: MessageSquareIcon,
            id: "selection-request-changes",
            keys: requestChangesKey,
            label: t("requestChanges", {
              count: decidable.length,
              partial: decidable.length < posts.length ? "yes" : "no",
              total: posts.length,
            }),
            run: askForChanges,
          },
        ]),
    ...(unschedulable.length === 0
      ? []
      : [
          {
            icon: Undo2Icon,
            id: "selection-unschedule",
            keys: backToDraftKey,
            label: t("backToDraft", {
              count: unschedulable.length,
              partial: unschedulable.length < posts.length ? "yes" : "no",
              total: posts.length,
            }),
            run: backToDraft,
          },
        ]),
    ...(cancellable.length === 0
      ? []
      : [
          {
            icon: BanIcon,
            id: "selection-cancel",
            keys: cancelKey,
            label: t("cancel", {
              count: cancellable.length,
              partial: cancellable.length < posts.length ? "yes" : "no",
              total: posts.length,
            }),
            run: askToCancel,
          },
        ]),
  ];

  usePageCommands({
    commands,
    heading: t("heading", { count: posts.length }),
    label: t("scope", { count: posts.length }),
  });

  const idle = () =>
    !busy && !decide.busy && !confirming && !approving && !asking;

  useShortcut(
    addTagKey,
    () => {
      openMenu(addTagCommand);
    },
    { description: t("addTag"), when: () => mayTag && idle() }
  );

  useShortcut(approveKey, askToApprove, {
    description: t("approveKey"),
    when: () => decidable.length > 0 && idle(),
  });

  useShortcut(requestChangesKey, askForChanges, {
    description: t("requestChangesKey"),
    when: () => decidable.length > 0 && idle(),
  });

  useShortcut(
    backToDraftKey,
    () => {
      void backToDraft();
    },
    {
      description: t("backToDraftKey"),
      when: () => unschedulable.length > 0 && idle(),
    }
  );

  useShortcut(cancelKey, askToCancel, {
    description: t("cancelKey"),
    when: () => cancellable.length > 0 && idle(),
  });

  return (
    <>
      <SelectionBar label={t("label")} disabled={busy || decide.busy}>
        <SelectionCount>{t("count", { count: posts.length })}</SelectionCount>
        <SelectionBarAction
          aria-keyshortcuts={menuHint.ariaKeyshortcuts}
          onClick={() => {
            openMenu(null);
          }}
        >
          <CommandIcon aria-hidden />
          {t("actions")}
        </SelectionBarAction>
        <SelectionBarClear label={t("clear")} onClick={onClear} />
      </SelectionBar>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("cancelTitle", { count: cancellable.length })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("cancelDescription", { count: cancellable.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("keep", { count: cancellable.length })}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => {
                void cancelAll();
              }}
            >
              {t("cancelConfirm", { count: cancellable.length })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={approving} onOpenChange={setApproving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("approveTitle", { count: decidable.length })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("approveDescription", { count: decidable.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("notYet")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || decide.busy}
              onClick={() => {
                void approveAll();
              }}
            >
              {t("approveConfirm", { count: decidable.length })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <RequestChangesDialog
        count={decidable.length}
        open={asking}
        onOpenChange={setAsking}
        onSubmit={requestChangesOnAll}
      />
    </>
  );
};
