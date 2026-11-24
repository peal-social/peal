"use client";

import { CalendarIcon, EllipsisIcon, RadioTowerIcon } from "lucide-react";
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
import { useId, useState } from "react";

import { kinds, maxTitleLength } from "#analytics/widgets.ts";
import type { Period, WidgetKind } from "#analytics/widgets.ts";
import { channelName } from "#channels/channel-name.ts";
import { PlatformMark } from "#components/channels/platform-mark.tsx";
import { FilterMenu, useFilterMenu } from "#components/lists/filter-menu.tsx";
import type { FilterProperty } from "#components/lists/filter-menu.tsx";

/**
 * A widget's filter, the list's Filter menu (DESIGN.md, "Lists: filters
 * and display") for one widget: an outline icon button, blue while the
 * widget shows other than its own; its menu searches the widget's
 * properties, Period and, where its kind may show one, Channel, each a
 * page of values. A period is always chosen: choosing the one shown
 * again keeps it. A channel chosen again shows every channel, but where
 * the kind needs one.
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
  const menu = useFilterMenu({ shortcut: false });
  const described = kinds[kind];
  const byChannel = described.channel !== "none" && channels.length > 0;

  const properties: readonly FilterProperty[] = [
    {
      icon: CalendarIcon,
      id: "period",
      label: t("periodLabel"),
      values: described.periods.map((each) => ({
        id: each,
        label: t("period", { period: each }),
      })),
    },
    ...(byChannel
      ? [
          {
            icon: RadioTowerIcon,
            id: "channel",
            label: t("channelLabel"),
            values: channels.map((channel) => ({
              id: channel.id,
              label: channelName(channel),
              mark: <PlatformMark platform={channel.platform} />,
            })),
          },
        ]
      : []),
  ];

  return (
    <FilterMenu
      active={
        period !== described.period ||
        (described.channel === "optional" && channelId !== null)
      }
      chosen={{
        channel: channelId === null ? [] : [channelId],
        period: [period],
      }}
      label={t("filter", { name })}
      quiet
      shortcut={false}
      properties={properties}
      state={menu}
      onChoose={(property, values) => {
        const [value] = values;

        if (property === "period") {
          const found = described.periods.find((each) => each === value);

          if (found !== undefined) {
            onPeriod(found);
          }

          return;
        }

        if (value !== undefined || described.channel === "optional") {
          onChannel(value ?? null);
        }
      }}
    />
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
