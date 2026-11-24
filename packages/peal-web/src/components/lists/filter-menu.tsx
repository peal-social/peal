"use client";

import { useShortcut, useShortcutHint } from "@ui-sdk/react/shortcuts";
import type { LucideIcon } from "lucide-react";
import { CheckIcon, ChevronRightIcon, ListFilterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandItemCheck,
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

/**
 * A property a list can be narrowed by, with its values. `multiple`: the
 * list can keep several of them at once ("Channel is any of A, B");
 * otherwise one at a time.
 */
export interface FilterProperty {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly multiple?: boolean;
  readonly values: readonly FilterValue[];
}

/** The menu's page of a property's values. */
const pageOf = (property: string) => `property:${property}`;

/** Whether the Filter menu is open, and on which property's page. */
export interface FilterMenuState {
  readonly open: boolean;
  readonly startAt: string | null;
  /** Opens the menu, on a property's page when one is named. */
  readonly openAt: (property: string | null) => void;
  readonly setOpen: (open: boolean) => void;
}

/**
 * The Filter menu's state, and F, which opens it on the list's page
 * (DESIGN.md, "Filters and display"): one per list. A menu among many on
 * a page, as each analytics widget's, takes no key (`shortcut: false`).
 */
export const useFilterMenu = ({
  shortcut = true,
}: { readonly shortcut?: boolean } = {}): FilterMenuState => {
  const t = useTranslations("Lists");

  const [menu, setMenu] = useState<{
    readonly open: boolean;
    readonly startAt: string | null;
  }>({ open: false, startAt: null });

  const openAt = (property: string | null) => {
    setMenu({ open: true, startAt: property });
  };

  useShortcut(
    shortcut ? listKeys.filter : null,
    () => {
      openAt(null);
    },
    { description: t("filter") }
  );

  return {
    open: menu.open,
    openAt,
    setOpen: (open) => {
      setMenu({ open, startAt: open ? menu.startAt : null });
    },
    startAt: menu.startAt,
  };
};

/**
 * The Filter menu (DESIGN.md, "Filters and display"): the toolbar's
 * Filter button and its popover, a search over the list's properties,
 * each opening a page of its values; typed text searches every value at
 * once. Choosing a value calls `onChoose` with the property's values: of
 * a property with one at a time, that value alone, or none when it was
 * the one chosen, and the menu closes; of a `multiple` one, the values
 * with this one put in or taken out, its box ticked or not, and the menu
 * stays open for the next. The menu opens on `state.startAt`'s page, as a
 * chip's value does.
 */
export const FilterMenu = ({
  active,
  chosen,
  label,
  onChoose,
  properties,
  shortcut = true,
  state,
}: {
  /** Whether the button shows the list narrowed: by default, a value is chosen. */
  readonly active?: boolean;
  /** The button's name, "Filter" unless the menu filters one thing of many. */
  readonly label?: string;
  /** Whether the button names F, the list's key for it. */
  readonly shortcut?: boolean;
  /** The values chosen for each property, by the property's id. */
  readonly chosen: Readonly<Record<string, readonly string[]>>;
  readonly onChoose: (property: string, values: readonly string[]) => void;
  readonly properties: readonly FilterProperty[];
  readonly state: FilterMenuState;
}) => {
  const { open, startAt } = state;
  const onOpenChange = state.setOpen;
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
  ) => {
    const values = chosen[property.id] ?? [];
    const isChosen = values.includes(value.id);

    return (
      <CommandItem
        key={`${property.id}:${value.id}`}
        value={`value:${property.id}:${value.id}`}
        label={named ? `${property.label} ${value.label}` : value.label}
        onSelect={() => {
          if (property.multiple === true) {
            onChoose(
              property.id,
              isChosen
                ? values.filter((id) => id !== value.id)
                : [...values, value.id]
            );

            return;
          }

          onChoose(property.id, isChosen ? [] : [value.id]);
          onOpenChange(false);
        }}
      >
        {property.multiple === true ? (
          <CommandItemCheck checked={isChosen} />
        ) : null}
        {value.mark === undefined ? null : (
          <CommandItemIcon>{value.mark}</CommandItemIcon>
        )}
        <CommandItemText>
          {named ? `${property.label} › ${value.label}` : value.label}
        </CommandItemText>
        {isChosen && property.multiple !== true ? (
          <CommandItemEnd>
            <CheckIcon aria-label={t("chosen")} />
          </CommandItemEnd>
        ) : null}
      </CommandItem>
    );
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <ListToolButton
                  aria-label={label ?? t("filter")}
                  aria-keyshortcuts={
                    shortcut ? hint.ariaKeyshortcuts : undefined
                  }
                  active={
                    active ??
                    Object.values(chosen).some((values) => values.length > 0)
                  }
                />
              }
            />
          }
        >
          <ListFilterIcon aria-hidden />
        </TooltipTrigger>
        <TooltipContent>
          {label ?? t("filter")}
          {shortcut ? ` ${hint.text}` : null}
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
            {(found) => t("noMatch", { query: found.query })}
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
