"use client";

import { EllipsisIcon, ListFilterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SocialChannel } from "peal-contract";
import { Button } from "peal-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "peal-ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "peal-ui/components/dropdown-menu";
import { Input } from "peal-ui/components/input";
import { Label } from "peal-ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "peal-ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "peal-ui/components/select";
import { useId, useState } from "react";

import { kinds, maxTitleLength } from "#analytics/widgets.ts";
import type { Period, WidgetKind } from "#analytics/widgets.ts";
import { channelName } from "#channels/channel-name.ts";

const allChannels = "all";

/**
 * A widget's filter: its period and, where its kind may show one, its
 * channel. A dot marks the button while either is not the kind's own.
 */
export const WidgetFilter = ({
  channelId,
  channels,
  kind,
  name,
  onChannel,
  onPeriod,
  period,
}: {
  readonly channelId: string | null;
  readonly channels: readonly SocialChannel[];
  readonly kind: WidgetKind;
  readonly name: string;
  readonly onChannel: (channelId: string | null) => void;
  readonly onPeriod: (period: Period) => void;
  readonly period: Period;
}) => {
  const t = useTranslations("Analytics.widgets");
  const periodLabel = useId();
  const channelLabel = useId();
  const described = kinds[kind];

  const changed =
    period !== described.period ||
    (described.channel === "optional" && channelId !== null);

  const chosen = channels.find(({ id }) => id === channelId);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("filter", { name })}
            className="relative"
          />
        }
      >
        <ListFilterIcon aria-hidden />
        {changed ? (
          <span
            aria-hidden="true"
            className="bg-brand absolute top-1 right-1 size-1.5 rounded-full"
          />
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end">
        <p className="text-muted-foreground text-xs">{t("filterBy")}</p>
        <div className="flex flex-col gap-1.5">
          <Label id={periodLabel}>{t("periodLabel")}</Label>
          <Select
            value={period}
            onValueChange={(value: string | null) => {
              const found = described.periods.find((each) => each === value);

              if (found !== undefined) {
                onPeriod(found);
              }
            }}
          >
            <SelectTrigger aria-labelledby={periodLabel} className="w-full">
              <SelectValue>{t("period", { period })}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {described.periods.map((each) => (
                <SelectItem key={each} value={each}>
                  {t("period", { period: each })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {described.channel === "none" || channels.length === 0 ? null : (
          <div className="flex flex-col gap-1.5">
            <Label id={channelLabel}>{t("channelLabel")}</Label>
            <Select
              value={channelId ?? allChannels}
              onValueChange={(value: string | null) => {
                if (value !== null) {
                  onChannel(value === allChannels ? null : value);
                }
              }}
            >
              <SelectTrigger aria-labelledby={channelLabel} className="w-full">
                <SelectValue>
                  {chosen === undefined
                    ? t("allChannels")
                    : channelName(chosen)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {described.channel === "optional" ? (
                  <SelectItem value={allChannels}>
                    {t("allChannels")}
                  </SelectItem>
                ) : null}
                {channels.map((each) => (
                  <SelectItem key={each.id} value={each.id}>
                    {channelName(each)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

/** What a widget's menu does. */
export interface WidgetMenuActions {
  readonly onDuplicate: () => void;
  readonly onRemove: () => void;
  readonly onRename: () => void;
}

/**
 * A widget's "…" menu: duplicate, rename, and remove it, which Undo takes
 * back.
 */
export const WidgetMenu = ({
  name,
  onDuplicate,
  onRemove,
  onRename,
}: WidgetMenuActions & { readonly name: string }) => {
  const t = useTranslations("Analytics.widgets");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("more", { name })}
          />
        }
      >
        <EllipsisIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onDuplicate}>
            {t("duplicate")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRename}>{t("rename")}</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onRemove}>
          {t("remove")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/** Names a widget: an empty name gives it back its kind's. */
export const RenameWidgetDialog = ({
  current,
  onClose,
  onRename,
  open,
}: {
  readonly current: string;
  readonly onClose: () => void;
  readonly onRename: (title: string) => void;
  readonly open: boolean;
}) => {
  const t = useTranslations("Analytics.widgets");
  const field = useId();
  const hint = useId();
  const [title, setTitle] = useState(current);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setTitle(current);
        } else {
          onClose();
        }
      }}
    >
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onRename(title);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("rename")}</DialogTitle>
            <DialogDescription id={hint}>{t("renameHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={field}>{t("renameLabel")}</Label>
            <Input
              id={field}
              aria-describedby={hint}
              maxLength={maxTitleLength}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit">{t("save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
