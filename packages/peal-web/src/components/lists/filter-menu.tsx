"use client";

import { useShortcutHint } from "@ui-sdk/react/shortcuts";
import type { LucideIcon } from "lucide-react";
import { CheckIcon, ChevronRightIcon, ListFilterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandItemEnd,
  CommandItemIcon,
  CommandItemText,
  CommandList,
  CommandPage,
} from "peal-ui/components/command";
import {
  FilterMenuContent,
  ListToolButton,
} from "peal-ui/components/list-toolbar";
import { Popover, PopoverTrigger } from "peal-ui/components/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "peal-ui/components/tooltip";
import { useState } from "react";
import type { ReactNode } from "react";

import { listKeys } from "#shell/keys.ts";

/** One value a list can be narrowed to, like a channel. */
export interface FilterValue {
  readonly id: string;
  readonly label: string;
  /** Before the label, like a tag's dot. */
  readonly mark?: ReactNode;
}

/** A property a list can be narrowed by, with its values. */
export interface FilterProperty {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly values: readonly FilterValue[];
}

/** The menu's page of a property's values. */
const pageOf = (property: string) => `property:${property}`;

/**
 * The Filter menu (DESIGN.md, "Filters and display"): the toolbar's
 * Filter button and its popover, a search over the list's properties,
 * each opening a page of its values; typed text searches every value at
 * once. Choosing a value calls `onChoose`; choosing the one already chosen
 * takes it off (`null`). `startAt` opens the menu on a property's page,
 * as a chip's value does.
 */
export const FilterMenu = ({
  active,
  chosen,
  onChoose,
  onOpenChange,
  open,
  properties,
  startAt,
}: {
  /** Whether the button shows the list narrowed: by default, a value is chosen. */
  readonly active?: boolean;
  /** The value chosen for each property, by the property's id. */
  readonly chosen: Readonly<Record<string, string | undefined>>;
  readonly onChoose: (property: string, value: string | null) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly properties: readonly FilterProperty[];
  readonly startAt: string | null;
}) => {
  const t = useTranslations("Lists");
  const hint = useShortcutHint(listKeys.filter);
  const [query, setQuery] = useState("");
  const [stack, setStack] = useState<string[]>([]);
  // The menu starts again each time it opens, on `startAt`'s page if any.
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);

    if (open) {
      setQuery("");
      setStack(startAt === null ? [] : [pageOf(startAt)]);
    }
  }

  const shown = properties.find(({ id }) => pageOf(id) === stack.at(-1));
  const typed = query.trim() !== "";

  const valueItem = (
    property: FilterProperty,
    value: FilterValue,
    named: boolean
  ) => (
    <CommandItem
      key={`${property.id}:${value.id}`}
      value={`value:${property.id}:${value.id}`}
      label={named ? `${property.label} ${value.label}` : value.label}
      onSelect={() => {
        onChoose(
          property.id,
          chosen[property.id] === value.id ? null : value.id
        );
        onOpenChange(false);
      }}
    >
      {value.mark === undefined ? null : (
        <CommandItemIcon>{value.mark}</CommandItemIcon>
      )}
      <CommandItemText>
        {named ? `${property.label} › ${value.label}` : value.label}
      </CommandItemText>
      {chosen[property.id] === value.id ? (
        <CommandItemEnd>
          <CheckIcon aria-label={t("chosen")} />
        </CommandItemEnd>
      ) : null}
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <ListToolButton
                  aria-label={t("filter")}
                  aria-keyshortcuts={hint.ariaKeyshortcuts}
                  active={
                    active ??
                    Object.values(chosen).some((value) => value !== undefined)
                  }
                />
              }
            />
          }
        >
          <ListFilterIcon aria-hidden />
        </TooltipTrigger>
        <TooltipContent>
          {t("filter")} {hint.text}
        </TooltipContent>
      </Tooltip>
      <FilterMenuContent>
        <Command
          loop
          query={query}
          onQueryChange={setQuery}
          pages={stack}
          onPagesChange={setStack}
          filter="contains"
        >
          <CommandInput
            aria-label={shown?.label ?? t("filter")}
            placeholder={shown?.label ?? t("filterPlaceholder")}
          />
          <CommandEmpty>
            {(state) => t("noMatch", { query: state.query })}
          </CommandEmpty>
          <CommandList>
            {properties.map((property) => (
              <CommandPage key={property.id} value={pageOf(property.id)}>
                <CommandGroup aria-label={property.label}>
                  {property.values.map((value) =>
                    valueItem(property, value, false)
                  )}
                </CommandGroup>
              </CommandPage>
            ))}
            <CommandPage>
              <CommandGroup aria-label={t("properties")}>
                {properties.map((property) => {
                  const Icon = property.icon;

                  return (
                    <CommandItem
                      key={property.id}
                      value={pageOf(property.id)}
                      page={pageOf(property.id)}
                      label={property.label}
                    >
                      <CommandItemIcon>
                        <Icon />
                      </CommandItemIcon>
                      <CommandItemText>{property.label}</CommandItemText>
                      <CommandItemEnd>
                        <ChevronRightIcon aria-hidden />
                      </CommandItemEnd>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {typed ? (
                <CommandGroup aria-label={t("values")}>
                  {properties.flatMap((property) =>
                    property.values.map((value) =>
                      valueItem(property, value, true)
                    )
                  )}
                </CommandGroup>
              ) : null}
            </CommandPage>
          </CommandList>
        </Command>
      </FilterMenuContent>
    </Popover>
  );
};
