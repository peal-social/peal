"use client";

import { Option, Schema } from "effect";
import { CalendarDaysIcon, ListIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import type { Layouts } from "#components/lists/display-menu.tsx";
import { usePathname, useRouter } from "#i18n/navigation.ts";
import { PostsLayoutSchema, layoutQuery } from "#posts/posts-layout.ts";
import type { PostsLayout } from "#posts/posts-layout.ts";

const decodeLayout = Schema.decodeUnknownOption(PostsLayoutSchema);

/**
 * The posts page's layouts for its Display panel: the list and the
 * calendar, `chosen` the one it shows. Choosing the other writes the
 * address (`layoutQuery`), keeping the filters both read, the page
 * staying where it is.
 */
export const usePostsLayouts = (chosen: PostsLayout): Layouts => {
  const t = useTranslations("Posts.List");
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();

  return {
    chosen,
    onChoose: (id) => {
      const layout = decodeLayout(id);

      if (Option.isNone(layout)) {
        return;
      }

      const written = layoutQuery(query, layout.value);

      router.replace(written === "" ? pathname : `${pathname}?${written}`, {
        scroll: false,
      });
    },
    options: [
      { icon: ListIcon, id: "list", label: t("layoutList") },
      { icon: CalendarDaysIcon, id: "calendar", label: t("layoutCalendar") },
    ],
  };
};
