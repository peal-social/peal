"use client";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Exit, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import { maxChannelSetNameLength, forWorkspace } from "peal-contract";
import type { ChannelOptions, ChannelSet } from "peal-contract";
import { Button } from "peal-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "peal-ui/components/dialog";
import { Input } from "peal-ui/components/input";
import { Label } from "peal-ui/components/label";
import { toast } from "peal-ui/components/toast";
import { useId, useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import {
  channelSetsChanged,
  createChannelSet,
  workspaceChannelSets,
} from "#channel-sets/atoms.ts";
import { channelSetDetailsOf } from "#channel-sets/selection.ts";
import { SavedItemErrorAlert } from "#components/settings/saved-item-error.tsx";
import { savedItemErrorOf } from "#settings/saved-item-error.ts";
import type { SavedItemError } from "#settings/saved-item-error.ts";

const noSets: readonly ChannelSet[] = [];

/**
 * The workspace's channel sets, to start a post from one in the
 * channels' picker: none until they are known, or while the post can no
 * longer be written.
 */
export const useChannelSets = (
  workspaceId: string,
  editable: boolean
): readonly ChannelSet[] => {
  const sets = useAtomValue(workspaceChannelSets(workspaceId));

  return editable && AsyncResult.isSuccess(sets) ? sets.value : noSets;
};

/**
 * Saves the channels chosen, and the options filled for them, as a set
 * under the name the member gives: the dialog the channels' picker opens
 * with "Save as a set…".
 */
export const SaveSelectionDialog = ({
  channelIds,
  onOpenChange,
  open,
  options,
  workspaceId,
}: {
  readonly channelIds: readonly string[];
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly options: readonly ChannelOptions[];
  readonly workspaceId: string;
}) => {
  const t = useTranslations("ChannelSets");
  const settings = useTranslations("Settings");
  const tComposer = useTranslations("Posts.Composer");
  const create = useAtomSet(createChannelSet, { mode: "promiseExit" });
  const nameId = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState<SavedItemError | null>(null);
  const [isPending, startTransition] = useTransition();
  const details = channelSetDetailsOf(name, channelIds, options);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (Option.isNone(details)) {
      return;
    }

    startTransition(async () => {
      const exit = await create({
        headers: forWorkspace(workspaceId),
        payload: details.value,
        reactivityKeys: channelSetsChanged(workspaceId),
      });

      if (Exit.isSuccess(exit)) {
        setError(null);
        setName("");
        onOpenChange(false);
        toast.success(t("created"));
      } else {
        setError(
          Option.getOrElse(savedItemErrorOf(exit), (): SavedItemError => ({
            key: "unknown",
          }))
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tComposer("closeDialog")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("saveSelectionTitle")}</DialogTitle>
            <DialogDescription>
              {t("saveSelectionDescription", { count: channelIds.length })}
            </DialogDescription>
          </DialogHeader>
          <SavedItemErrorAlert error={error} kind="channelSet" />
          <div className="flex flex-col gap-2">
            <Label htmlFor={nameId}>{t("name")}</Label>
            <Input
              id={nameId}
              value={name}
              maxLength={maxChannelSetNameLength}
              disabled={isPending}
              required
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => {
                onOpenChange(false);
              }}
            >
              {settings("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isPending || Option.isNone(details)}
              focusableWhenDisabled
            >
              {isPending ? t("creating") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
