"use client";

import { PlugIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { aiProviders } from "peal-contract/ai-providers";
import type { AiProviderId } from "peal-contract/ai-providers";
import { Label } from "peal-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectValueIcon,
} from "peal-ui/components/select";
import type { SimpleIcon } from "simple-icons";
import {
  siAnthropic,
  siDeepseek,
  siGooglegemini,
  siMistralai,
  siOpenrouter,
} from "simple-icons";

import { isAnotherProvider } from "#assistant/provider-catalogue.ts";
import { BrandMark } from "#components/shell/brand-mark.tsx";

// The marks simple-icons holds; a provider without one shows its initial
// (DESIGN.md, "Icons": never a mark drawn from memory).
const marks: Partial<Record<AiProviderId, SimpleIcon>> = {
  anthropic: siAnthropic,
  deepseek: siDeepseek,
  google: siGooglegemini,
  mistral: siMistralai,
  openrouter: siOpenrouter,
};

/** A provider's mark, its initial without one, a plug for another provider. */
export const ProviderMark = ({
  provider,
}: {
  readonly provider: AiProviderId;
}) => {
  if (isAnotherProvider(provider)) {
    return <PlugIcon aria-hidden />;
  }

  const mark = marks[provider];

  return mark === undefined ? (
    <span aria-hidden className="text-xs font-semibold">
      {aiProviders[provider].name.slice(0, 1)}
    </span>
  ) : (
    <BrandMark icon={mark} />
  );
};

/** A provider's mark on a tile, as a settings row starts with it. */
export const ProviderTile = ({
  provider,
}: {
  readonly provider: AiProviderId;
}) => (
  <span
    aria-hidden
    className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-4.5"
  >
    <ProviderMark provider={provider} />
  </span>
);

/**
 * A provider's name: its own, never translated, or "Another provider"
 * for an endpoint of the member's.
 */
export const useProviderName = () => {
  const t = useTranslations("Assistant.providers");

  return (provider: AiProviderId) =>
    isAnotherProvider(provider) ? t("other") : aiProviders[provider].name;
};

/**
 * The provider to connect, among those the workspace has not connected
 * yet: choosing one fills in its address, so the member only adds a key.
 */
export const ProviderPicker = ({
  disabled,
  id,
  onChoose,
  options,
  value,
}: {
  readonly disabled: boolean;
  readonly id: string;
  readonly onChoose: (provider: AiProviderId) => void;
  readonly options: readonly AiProviderId[];
  readonly value: AiProviderId;
}) => {
  const t = useTranslations("Assistant.providers");
  const nameOf = useProviderName();

  return (
    <div className="flex flex-col gap-1.5">
      <Label id={id}>{t("provider")}</Label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(chosen: string | null) => {
          const provider = options.find((each) => each === chosen);

          if (provider !== undefined) {
            onChoose(provider);
          }
        }}
      >
        <SelectTrigger aria-labelledby={id} className="w-full">
          <SelectValueIcon />
          <SelectValue>{nameOf(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((provider) => (
            <SelectItem
              key={provider}
              value={provider}
              label={nameOf(provider)}
              icon={<ProviderMark provider={provider} />}
            >
              {nameOf(provider)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
