"use client";

import { FileImageIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { maxMediaQueryLength, MediaKindSchema } from "peal-contract";
import type { MediaKind } from "peal-contract";
import { Input } from "peal-ui/components/input";
import {
  FilterChip,
  FilterChips,
  FilterChipsClear,
  ListToolbar,
  ListToolbarEnd,
} from "peal-ui/components/list-toolbar";
import { useId } from "react";
import type { Ref } from "react";

import { FilterMenu, useFilterMenu } from "#components/lists/filter-menu.tsx";
import type { LibrarySearch } from "#media/library-search.ts";

const kinds = MediaKindSchema.literals;

const kindOf = (value: string | undefined): MediaKind | null =>
  kinds.find((kind) => kind === value) ?? null;

/**
 * The library's toolbar (DESIGN.md, "Filters and display"): a search of
 * the files' names and descriptions, then Filter, whose one property is
 * the kind, its chip under them with Clear. It says what the person
 * chose; the list asks the API once they pause.
 */
export const LibraryToolbarView = ({
  inputRef,
  onSearch,
  search,
}: {
  /** The search field, which clearing the search gives the focus back to. */
  readonly inputRef?: Ref<HTMLInputElement> | undefined;
  readonly onSearch: (search: LibrarySearch) => void;
  readonly search: LibrarySearch;
}) => {
  const t = useTranslations("Media.library");
  const lists = useTranslations("Lists");
  const searchId = useId();
  const menu = useFilterMenu();

  const kindProperty = {
    icon: FileImageIcon,
    id: "kind",
    label: t("kindFilter"),
    values: kinds.map((kind) => ({ id: kind, label: t("kind", { kind }) })),
  };

  return (
    <search className="flex flex-col gap-2">
      <ListToolbar>
        <div className="flex min-w-48 flex-1 items-center gap-2">
          <SearchIcon aria-hidden className="text-muted-foreground size-4" />
          <label htmlFor={searchId} className="sr-only">
            {t("search")}
          </label>
          <Input
            ref={inputRef}
            id={searchId}
            type="search"
            value={search.text}
            maxLength={maxMediaQueryLength}
            placeholder={t("searchPlaceholder")}
            onChange={(event) => {
              onSearch({ ...search, text: event.target.value });
            }}
          />
        </div>
        <ListToolbarEnd>
          <FilterMenu
            chosen={{ kind: search.kind === null ? [] : [search.kind] }}
            properties={[kindProperty]}
            state={menu}
            onChoose={(_, values) => {
              onSearch({ ...search, kind: kindOf(values[0]) });
            }}
          />
        </ListToolbarEnd>
      </ListToolbar>
      {search.kind === null ? null : (
        <FilterChips aria-label={lists("filters")}>
          <FilterChip
            icon={<FileImageIcon aria-hidden />}
            join={lists("is")}
            property={t("kindFilter")}
            removeLabel={lists("remove", { property: t("kindFilter") })}
            value={t("kind", { kind: search.kind })}
            onEdit={() => {
              menu.openAt("kind");
            }}
            onRemove={() => {
              onSearch({ ...search, kind: null });
            }}
          />
          <FilterChipsClear
            onClick={() => {
              onSearch({ ...search, kind: null });
            }}
          >
            {lists("clear")}
          </FilterChipsClear>
        </FilterChips>
      )}
    </search>
  );
};
