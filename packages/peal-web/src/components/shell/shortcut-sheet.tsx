"use client";

import { useShortcutHint } from "@ui-sdk/react/shortcuts";
import { useTranslations } from "next-intl";
import { Input } from "peal-ui/components/input";
import { Kbd, KbdSequence } from "peal-ui/components/kbd";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "peal-ui/components/sheet";
import { useState } from "react";

import type { ShortcutGroup, ShortcutRow } from "#shell/shortcut-sheet.ts";

// A press as the platform writes it: ⌘K on a Mac, Ctrl+K elsewhere.
const Press = ({ keys }: { readonly keys: string }) => (
  <Kbd>{useShortcutHint(keys).text}</Kbd>
);

// A line's keys: one press, or "G then C", and its other way if any.
const RowKeys = ({
  row,
  then,
}: {
  readonly row: ShortcutRow;
  readonly then: string;
}) => (
  <span className="flex shrink-0 items-center gap-1.5">
    {row.keys.length === 2 ? (
      <KbdSequence keys={[...row.keys]} then={then} />
    ) : (
      <Press keys={row.keys[0]} />
    )}
    {row.alternate === undefined ? null : <Press keys={row.alternate} />}
  </span>
);

// The text a search reads: case and accents set aside.
const plain = (text: string) =>
  text
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Every shortcut of the workspace (DESIGN.md, "Keys"), in a sheet on the
 * right that ⌘/ and the command menu open: a search, then each group's
 * lines, what they do and their keys. `groups` comes from
 * `shortcutGroupsOf`, and `pageName` names a "Go to" line's page,
 * `viewName` the posts list's tab.
 */
export const ShortcutSheet = ({
  groups,
  onOpenChange,
  open,
  pageName,
  viewName,
}: {
  readonly groups: readonly ShortcutGroup[];
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly pageName: (page: NonNullable<ShortcutRow["page"]>) => string;
  /** Names the tab of the posts list a "Go to" line opens. */
  readonly viewName: (status: NonNullable<ShortcutRow["status"]>) => string;
}) => {
  const t = useTranslations("Shortcuts");
  const [query, setQuery] = useState("");

  const textOf = (row: ShortcutRow) => {
    if (row.page !== undefined) {
      return t("rows.goTo", { page: pageName(row.page) });
    }

    return row.status === undefined
      ? t(`rows.${row.action}`)
      : t("rows.goTo", { page: viewName(row.status) });
  };

  const wanted = plain(query.trim());

  const shown = groups.flatMap((group) => {
    const rows = group.rows.filter(
      (row) =>
        wanted === "" ||
        plain(textOf(row)).includes(wanted) ||
        plain(t(`groups.${group.name}`)).includes(wanted)
    );

    return rows.length === 0 ? [] : [{ ...group, rows }];
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setQuery("");
        }

        onOpenChange(next);
      }}
    >
      <SheetContent closeLabel={t("close")}>
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6">
          <Input
            type="search"
            aria-label={t("search")}
            placeholder={t("search")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          {/* Mounted throughout, so a screen reader hears it change. */}
          <output className="text-muted-foreground empty:hidden">
            {shown.length === 0 ? t("empty", { query: query.trim() }) : ""}
          </output>
          {shown.map((group) => (
            <section key={group.name} className="flex flex-col gap-1">
              <h3 className="text-foreground mb-1 text-sm font-medium">
                {t(`groups.${group.name}`)}
              </h3>
              <ul className="flex flex-col">
                {group.rows.map((row) => (
                  <li
                    key={`${row.action}:${row.keys.join(" ")}`}
                    className="text-muted-foreground flex min-h-8 items-center justify-between gap-3"
                  >
                    <span className="min-w-0">{textOf(row)}</span>
                    <RowKeys row={row} then={t("then")} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
