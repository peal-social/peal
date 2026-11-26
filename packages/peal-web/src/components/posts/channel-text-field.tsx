"use client";

import type { Editor } from "@tiptap/core";
import { useTranslations } from "next-intl";
import type { SocialChannel } from "peal-contract";
import { Button } from "peal-ui/components/button";
import { PropertyRow } from "peal-ui/components/property";
import { useState } from "react";

import { PlainTextEditor } from "#components/posts/plain-text-editor.tsx";

interface ChannelTextFieldProps {
  readonly channel: SocialChannel;
  /** Hears the editor take the focus. */
  readonly onEditorFocus?: ((editor: Editor) => void) | undefined;
  /** Takes the channel's own text, or none to use the post's again. */
  readonly onOverride: (channelId: string, text: string | undefined) => void;
  /** Takes files pasted into the text, as `PlainTextEditor`'s. */
  readonly onPasteFiles?: ((files: readonly File[]) => boolean) | undefined;
  readonly readOnly: boolean;
  readonly value: string;
}

/**
 * A channel's text, as a row of its property list: the post's, with
 * **Write its own**, or a text of its own, which **Use the post's text**
 * takes back (a fresh editor).
 */
export const ChannelTextField = ({
  channel,
  onEditorFocus,
  onOverride,
  onPasteFiles,
  readOnly,
  value,
}: ChannelTextFieldProps) => {
  const t = useTranslations("Posts.Composer");
  const [writing, setWriting] = useState(false);
  const [resets, setResets] = useState(0);
  const labelId = `override-label-${channel.id}`;
  const own = writing || value !== "";

  return (
    <PropertyRow
      label={
        <span id={labelId}>
          <span aria-hidden="true" className="text-sm leading-none font-medium">
            {t("ownTextRow")}
          </span>
          <span className="sr-only">
            {t("overrideLabel", { handle: channel.handle })}
          </span>
        </span>
      }
    >
      {own ? (
        <>
          <PlainTextEditor
            key={resets}
            id={`override-${channel.id}`}
            labelledBy={labelId}
            describedBy={`${labelId}-hint`}
            placeholder={t("overridePlaceholder")}
            readOnly={readOnly}
            value={value}
            onChange={(text) => {
              onOverride(channel.id, text);
            }}
            onEditorFocus={onEditorFocus}
            onPasteFiles={onPasteFiles}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id={`${labelId}-hint`} className="text-muted-foreground text-xs">
              {value.trim() === "" ? t("usesCommonText") : null}
            </p>
            {readOnly ? null : (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  onOverride(channel.id, undefined);
                  setWriting(false);
                  setResets((count) => count + 1);
                }}
              >
                {t("resetOverride")}
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="flex min-h-8.5 flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {t("sameAsPost")}
          </span>
          {readOnly ? null : (
            <Button
              variant="ghost"
              size="xs"
              aria-label={t("writeOwnFor", { handle: channel.handle })}
              onClick={() => {
                setWriting(true);
              }}
            >
              {t("writeOwn")}
            </Button>
          )}
        </div>
      )}
    </PropertyRow>
  );
};
