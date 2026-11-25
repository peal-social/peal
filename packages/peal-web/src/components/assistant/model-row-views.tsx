"use client";

import {
  AudioLinesIcon,
  CaptionsIcon,
  ClapperboardIcon,
  GalleryHorizontalEndIcon,
  ImageIcon,
  TypeIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { maxImageProviderModelLength } from "peal-contract";
import type { AiCapability, AiProviderId } from "peal-contract/ai-providers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectValueIcon,
} from "peal-ui/components/select";
import {
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowText,
} from "peal-ui/components/settings";
import { useId, useState } from "react";

import { isSuggested } from "#assistant/models.ts";
import { modelsFor, takesModel } from "#assistant/provider-catalogue.ts";
import { InlineTextSetting } from "#components/settings/inline-text-setting.tsx";

import { ProviderMark, useProviderName } from "./provider-fields.tsx";

// Each use's icon: a later use gets its own here.
const icons: Readonly<Record<AiCapability, typeof TypeIcon>> = {
  composition: GalleryHorizontalEndIcon,
  image: ImageIcon,
  speech: AudioLinesIcon,
  text: TypeIcon,
  transcription: CaptionsIcon,
  video: ClapperboardIcon,
};

// The provider select's value for none of the workspace's.
const unset = "none";

// The model select's value for a model the catalogue does not suggest.
const otherModel = "other-model";

/** What a use is on: a provider and its model, or neither. */
export interface ModelChoice {
  readonly model: string | null;
  readonly provider: AiProviderId | null;
}

export interface ModelRowViewProps {
  readonly busy: boolean;
  readonly capability: AiCapability;
  readonly chosen: ModelChoice;
  /** The provider was chosen, and a model is to type: its field opens. */
  readonly onModel: (model: string) => Promise<boolean>;
  /** A provider, or null for the server's model or off. */
  readonly onProvider: (provider: AiProviderId | null) => void;
  /** The connected providers that offer the use. */
  readonly providers: readonly AiProviderId[];
  /** Whether the server has a model of its own for the use. */
  readonly serverModel: boolean;
}

// The model of a use on a provider: the catalogue's suggestions and
// **Another model…**, which opens a field; the field alone where the
// catalogue suggests none.
const ModelControl = ({
  busy,
  capability,
  model,
  onModel,
  provider,
  use,
}: {
  readonly busy: boolean;
  readonly capability: AiCapability;
  readonly model: string | null;
  readonly onModel: (model: string) => Promise<boolean>;
  readonly provider: AiProviderId;
  readonly use: string;
}) => {
  const t = useTranslations("Assistant.models");
  const ids = useId();
  const suggested = modelsFor(provider, capability);
  const listed = model !== null && isSuggested(provider, capability, model);
  // A model typed by hand keeps its field until one is picked again.
  const [typing, setTyping] = useState(false);
  const typed = suggested.length === 0 || typing || (model !== null && !listed);

  return (
    <>
      {suggested.length === 0 ? null : (
        <Select
          className="w-full sm:w-48"
          value={typed ? otherModel : (model ?? otherModel)}
          disabled={busy}
          onValueChange={(value: string | null) => {
            if (value === otherModel) {
              setTyping(true);

              return;
            }

            if (value !== null) {
              setTyping(false);
              void onModel(value);
            }
          }}
        >
          <SelectTrigger aria-label={t("model", { use })} className="w-full">
            <SelectValue>
              {typed ? t("otherModel") : (model ?? t("otherModel"))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {suggested.map((each) => (
              <SelectItem key={each} value={each}>
                {each}
              </SelectItem>
            ))}
            <SelectItem value={otherModel}>{t("otherModel")}</SelectItem>
          </SelectContent>
        </Select>
      )}
      {typed ? (
        <div className="w-full sm:w-48">
          <label htmlFor={`${ids}-model`} className="sr-only">
            {t("modelName", { use })}
          </label>
          <InlineTextSetting
            id={`${ids}-model`}
            autoComplete="off"
            disabled={busy}
            check={(typedModel) =>
              typedModel.length <= maxImageProviderModelLength
            }
            value={listed ? "" : (model ?? "")}
            save={onModel}
          />
        </div>
      ) : null}
    </>
  );
};

/**
 * One use's row (DESIGN.md, "Settings"): its icon, what it is for, and at
 * its end the provider (the connected ones that offer it, then "This
 * server's model" where the server has one, or "Off") and the model (the
 * catalogue's suggestions and **Another model…**, which opens a field,
 * saved on leaving it or on Enter), but for a use that takes no model
 * (slide videos), whose provider alone is chosen. Each applies as soon as
 * it changes.
 */
export const ModelRowView = ({
  busy,
  capability,
  chosen,
  onModel,
  onProvider,
  providers,
  serverModel,
}: ModelRowViewProps) => {
  const t = useTranslations("Assistant.models");
  const nameOf = useProviderName();
  const Icon = icons[capability];
  const use = t(`uses.${capability}`);
  const unsetLabel = serverModel ? t("server") : t("off");
  const hint = t(`hints.${capability}`);

  return (
    <SettingsRow>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden
          className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-4.5"
        >
          <Icon />
        </span>
        <SettingsRowText>
          <SettingsRowLabel>{use}</SettingsRowLabel>
          <SettingsRowDescription>
            {providers.length === 0 ? t("noProvider", { hint }) : hint}
          </SettingsRowDescription>
        </SettingsRowText>
      </div>
      <SettingsRowControl>
        <Select
          className="w-full sm:w-48"
          value={chosen.provider ?? unset}
          disabled={busy}
          onValueChange={(value: string | null) => {
            onProvider(providers.find((each) => each === value) ?? null);
          }}
        >
          <SelectTrigger aria-label={t("provider", { use })} className="w-full">
            <SelectValueIcon />
            <SelectValue>
              {chosen.provider === null ? unsetLabel : nameOf(chosen.provider)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {providers.map((provider) => (
              <SelectItem
                key={provider}
                value={provider}
                label={nameOf(provider)}
                icon={<ProviderMark provider={provider} />}
              >
                {nameOf(provider)}
              </SelectItem>
            ))}
            <SelectItem value={unset} label={unsetLabel}>
              {unsetLabel}
            </SelectItem>
          </SelectContent>
        </Select>
        {chosen.provider === null || !takesModel(capability) ? null : (
          <ModelControl
            key={chosen.provider}
            busy={busy}
            capability={capability}
            model={chosen.model}
            provider={chosen.provider}
            use={use}
            onModel={onModel}
          />
        )}
      </SettingsRowControl>
    </SettingsRow>
  );
};
