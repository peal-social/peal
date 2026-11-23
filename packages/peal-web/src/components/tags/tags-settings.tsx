"use client";

import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Exit, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import { maxTagsPerPost, maxTagsPerWorkspace } from "peal-contract";
import type { Tag } from "peal-contract";
import { Button } from "peal-ui/components/button";
import {
  SettingsCard,
  SettingsCardBody,
  SettingsRow,
  SettingsRowDescription,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionHeader,
  SettingsSectionTitle,
} from "peal-ui/components/settings";
import { toast } from "peal-ui/components/toast";
import { useId, useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import { useHydrated } from "#components/media/use-hydrated.ts";
import { DeleteSavedItem } from "#components/settings/delete-saved-item.tsx";
import {
  SettingsLoadFailed,
  SettingsLoading,
} from "#components/settings/settings-status.tsx";
import { savedItemErrorOf } from "#settings/saved-item-error.ts";
import type { SavedItemError } from "#settings/saved-item-error.ts";
import {
  createTag,
  deleteTag,
  tagsChanged,
  updateTag,
  workspaceTags,
} from "#tags/atoms.ts";
import { emptyTagDraft, tagDetailsOf } from "#tags/post-tags.ts";
import type { TagDraft } from "#tags/post-tags.ts";

import { TagFieldsView, TagItemView } from "./tag-views.tsx";

// A tag's form: its name and colour, saved together.
const EditForm = ({
  onClose,
  tag,
  workspaceId,
}: {
  readonly onClose: () => void;
  readonly tag: Tag;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Tags");
  const settings = useTranslations("Settings");
  const update = useAtomSet(updateTag, { mode: "promiseExit" });
  const [error, setError] = useState<SavedItemError | null>(null);
  const [isPending, startTransition] = useTransition();

  const [draft, setDraft] = useState<TagDraft>({
    colour: tag.colour,
    name: tag.name,
  });

  const details = tagDetailsOf(draft);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (Option.isNone(details)) {
      return;
    }

    startTransition(async () => {
      const exit = await update({
        params: { tagId: tag.id, workspaceId },
        payload: details.value,
        reactivityKeys: tagsChanged(workspaceId),
      });

      Option.match(savedItemErrorOf(exit), {
        onNone: () => {
          toast.success(t("saved"));
          onClose();
        },
        onSome: setError,
      });
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TagFieldsView
        draft={draft}
        error={error}
        disabled={isPending}
        idPrefix={tag.id}
        onChange={setDraft}
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={isPending || Option.isNone(details)}
          focusableWhenDisabled
        >
          {isPending ? settings("saving") : t("save")}
        </Button>
        <Button variant="outline" disabled={isPending} onClick={onClose}>
          {settings("cancel")}
        </Button>
      </div>
    </form>
  );
};

// One tag, with its form once the member opened it.
const TagRow = ({
  mayManage,
  tag,
  workspaceId,
}: {
  readonly mayManage: boolean;
  readonly tag: Tag;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Tags");
  const nameId = useId();
  const remove = useAtomSet(deleteTag, { mode: "promiseExit" });
  const [editing, setEditing] = useState(false);

  return (
    <TagItemView
      tag={tag}
      nameId={nameId}
      {...(mayManage
        ? {
            actions: (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  aria-describedby={nameId}
                  aria-expanded={editing}
                  onClick={() => {
                    setEditing(!editing);
                  }}
                >
                  {t("edit")}
                </Button>
                <DeleteSavedItem
                  describedBy={nameId}
                  kind="tag"
                  title={t("deleteTitle", { name: tag.name })}
                  description={t("deleteDescription")}
                  deleted={t("deleted")}
                  remove={async () =>
                    await remove({
                      params: { tagId: tag.id, workspaceId },
                      reactivityKeys: tagsChanged(workspaceId),
                    })
                  }
                />
              </>
            ),
          }
        : {})}
    >
      {editing ? (
        <EditForm
          tag={tag}
          workspaceId={workspaceId}
          onClose={() => {
            setEditing(false);
          }}
        />
      ) : null}
    </TagItemView>
  );
};

const LoadedTags = ({
  mayManage,
  workspaceId,
}: {
  readonly mayManage: boolean;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Tags");
  const atom = workspaceTags(workspaceId);
  const result = useAtomValue(atom);
  const reload = useAtomRefresh(atom);

  return AsyncResult.match(result, {
    onFailure: () => <SettingsLoadFailed onRetry={reload} />,
    onInitial: () => <SettingsLoading />,
    onSuccess: ({ value }) =>
      value.length === 0 ? (
        <SettingsCard>
          <SettingsRow>
            <SettingsRowDescription>{t("empty")}</SettingsRowDescription>
          </SettingsRow>
        </SettingsCard>
      ) : (
        <SettingsCard>
          <ul className="divide-y">
            {value.map((tag) => (
              <TagRow
                key={tag.id}
                mayManage={mayManage}
                tag={tag}
                workspaceId={workspaceId}
              />
            ))}
          </ul>
        </SettingsCard>
      ),
  });
};

/**
 * A new tag: its name and its colour. `onCreated` hears of the tag made,
 * for a place that files a post under it at once.
 */
export const CreateTagForm = ({
  idPrefix,
  onCreated,
  workspaceId,
}: {
  readonly idPrefix: string;
  readonly onCreated?: (tag: Tag) => void;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Tags");
  const create = useAtomSet(createTag, { mode: "promiseExit" });
  const [draft, setDraft] = useState<TagDraft>(emptyTagDraft);
  const [error, setError] = useState<SavedItemError | null>(null);
  const [isPending, startTransition] = useTransition();
  const details = tagDetailsOf(draft);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    // A form inside another, as in the composer, submits its own alone.
    event.stopPropagation();

    if (Option.isNone(details)) {
      return;
    }

    startTransition(async () => {
      const exit = await create({
        params: { workspaceId },
        payload: details.value,
        reactivityKeys: tagsChanged(workspaceId),
      });

      if (Exit.isSuccess(exit)) {
        setError(null);
        setDraft(emptyTagDraft);
        toast.success(t("created"));
        onCreated?.(exit.value);
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TagFieldsView
        draft={draft}
        error={error}
        disabled={isPending}
        idPrefix={idPrefix}
        onChange={setDraft}
      />
      <div>
        <Button
          type="submit"
          disabled={isPending || Option.isNone(details)}
          focusableWhenDisabled
        >
          {isPending ? t("creating") : t("create")}
        </Button>
      </div>
    </form>
  );
};

/**
 * The workspace's tags: the list, under what tags are for, their limits
 * and, to a member who may not change posts, why nothing can be changed;
 * then for those who may a form to add one, and to rename, recolour or
 * delete each.
 */
export const TagsSettings = ({
  mayManage,
  workspaceId,
}: {
  readonly mayManage: boolean;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Tags");
  const hydrated = useHydrated();

  return (
    <>
      <SettingsSection aria-labelledby="tags-title">
        <SettingsSectionHeader>
          <div className="min-w-0 flex-1">
            <SettingsSectionTitle id="tags-title">
              {t("listTitle")}
            </SettingsSectionTitle>
            <SettingsSectionDescription>
              {t("description")}{" "}
              {t("rules", {
                max: maxTagsPerWorkspace,
                perPost: maxTagsPerPost,
              })}
              {mayManage ? null : <> {t("readOnly")}</>}
            </SettingsSectionDescription>
          </div>
        </SettingsSectionHeader>
        {hydrated ? (
          <LoadedTags mayManage={mayManage} workspaceId={workspaceId} />
        ) : (
          <SettingsLoading />
        )}
      </SettingsSection>
      {mayManage ? (
        <SettingsSection aria-labelledby="create-tag-title">
          <SettingsSectionHeader>
            <SettingsSectionTitle id="create-tag-title">
              {t("createTitle")}
            </SettingsSectionTitle>
          </SettingsSectionHeader>
          <SettingsCard>
            <SettingsCardBody>
              <CreateTagForm idPrefix="new" workspaceId={workspaceId} />
            </SettingsCardBody>
          </SettingsCard>
        </SettingsSection>
      ) : null}
    </>
  );
};
