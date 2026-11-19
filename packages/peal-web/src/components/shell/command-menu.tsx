"use client";

import { useShortcut, useShortcutHint } from "@ui-sdk/react/shortcuts";
import { SquarePenIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Permission } from "peal-contract";
import { Button } from "peal-ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "peal-ui/components/tooltip";
import { useKeyMap } from "peal-ui/hooks/use-key-map";
import type { KeyBinding } from "peal-ui/hooks/use-key-map";
import { useState } from "react";

import { CommandMenuView } from "#components/shell/command-menu-view.tsx";
import type { MenuLink } from "#components/shell/command-menu-view.tsx";
import {
  useCommandScope,
  useMenuRequest,
  useShortcutSheet,
} from "#components/shell/command-scope.tsx";
import { ShortcutSheet } from "#components/shell/shortcut-sheet.tsx";
import { Link, useRouter } from "#i18n/navigation.ts";
import {
  goKeys,
  newPostKey,
  shortcutSheetKey,
  shortcutSheetShiftedKey,
} from "#shell/keys.ts";
import { pageLinksOf } from "#shell/navigation.ts";
import {
  postFilterCommands,
  postFilterHref,
} from "#shell/post-filter-commands.ts";
import { shortcutGroupsOf } from "#shell/shortcut-sheet.ts";
import { workspacePath } from "#shell/workspace-path.ts";

const AppLink: MenuLink = ({ children, href, ...props }) => (
  <Link href={href} {...props}>
    {children}
  </Link>
);

/**
 * The workspace's command menu, and the keys that work on every one of its
 * pages: C for a new post, G then a letter for the pages people open most.
 */
export const CommandMenu = ({
  docsUrl,
  permissions,
  supportUrl,
  workspaceId,
  workspaceSlug,
  workspaces,
}: {
  readonly docsUrl: string | null;
  readonly permissions: readonly Permission[];
  readonly supportUrl: string | null;
  readonly workspaceId: string;
  /** The workspace's slug, which its addresses hold. */
  readonly workspaceSlug: string;
  readonly workspaces: readonly {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  }[];
}) => {
  const t = useTranslations("CommandMenu");
  const shell = useTranslations("WorkspaceShell");
  const posts = useTranslations("Posts");
  const router = useRouter();
  const scope = useCommandScope();
  const newPostHint = useShortcutHint(newPostKey);
  const [open, setOpen] = useState(false);
  const request = useMenuRequest();
  // The request already answered: a new one opens the menu.
  const [answered, setAnswered] = useState(request.count);

  if (request.count !== answered) {
    setAnswered(request.count);
    setOpen(true);
  }

  // The sheet of every shortcut, which ⌘/ and Help open.
  const { open: sheetOpen, setOpen: setSheetOpen } = useShortcutSheet();

  const toggleSheet = () => {
    setSheetOpen((shown) => !shown);
  };

  useShortcut(shortcutSheetKey, toggleSheet, { description: t("shortcuts") });

  // Where / is typed with Shift, as on a French keyboard, ⌘/ is ⌘⇧/.
  useShortcut(shortcutSheetShiftedKey, toggleSheet, {
    description: t("shortcuts"),
  });

  const pages = pageLinksOf({
    permissions,
    workspace: workspaceSlug,
  });

  const newPostHref = permissions.includes("post:create")
    ? workspacePath(workspaceSlug, "/posts/new")
    : null;

  const bindings: KeyBinding[] = [
    ...(newPostHref === null
      ? []
      : [
          {
            description: t("newPost"),
            keys: [newPostKey] as const,
            run: () => {
              router.push(newPostHref);
            },
          },
        ]),
    ...pages.flatMap(({ href, page }) => {
      const key = goKeys[page];

      return key === undefined
        ? []
        : [
            {
              description: t("goTo", { page: shell(`pages.${page}`) }),
              keys: ["g", key] as const,
              run: () => {
                router.push(href);
              },
            },
          ];
    }),
  ];

  useKeyMap(bindings);

  // The posts list's states, where the member may open the list.
  const postFilters = pages.some(({ page }) => page === "posts")
    ? postFilterCommands.map((command) => ({
        href: postFilterHref(workspaceSlug, command),
        label: t("postsWith", {
          state:
            command.kind === "status"
              ? posts("status", { status: command.status })
              : posts("outcome", { outcome: command.outcome }),
        }),
      }))
    : [];

  return (
    <>
      <CommandMenuView
        docsUrl={docsUrl}
        link={AppLink}
        newPostHref={newPostHref}
        onOpenChange={setOpen}
        onShortcuts={() => {
          setSheetOpen(true);
        }}
        open={open}
        pages={pages}
        postFilters={postFilters}
        request={request}
        scope={scope}
        supportUrl={supportUrl}
        workspaces={workspaces
          .filter(({ id }) => id !== workspaceId)
          .map(({ id, name, slug }) => ({
            href: workspacePath(slug),
            id,
            name,
          }))}
      />
      {newPostHref === null ? null : (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("newPost")}
                aria-keyshortcuts={newPostHint.ariaKeyshortcuts}
                render={<Link href={newPostHref} />}
              />
            }
          >
            <SquarePenIcon aria-hidden />
          </TooltipTrigger>
          <TooltipContent>
            {t("newPost")} {newPostHint.text}
          </TooltipContent>
        </Tooltip>
      )}
      <ShortcutSheet
        groups={shortcutGroupsOf({
          canCreate: newPostHref !== null,
          pages: pages.map(({ page }) => page),
        })}
        open={sheetOpen}
        pageName={(page) => shell(`pages.${page}`)}
        onOpenChange={setSheetOpen}
      />
    </>
  );
};
