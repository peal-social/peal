"use client";

import { useShortcutHint } from "@ui-sdk/react/shortcuts";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRightIcon,
  BookOpenIcon,
  KeyboardIcon,
  LifeBuoyIcon,
  ListFilterIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Command,
  CommandChip,
  CommandDialog,
  CommandDialogContent,
  CommandDialogIconTrigger,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandItemCheck,
  CommandItemHint,
  CommandItemIcon,
  CommandItemText,
  CommandKeys,
  CommandList,
  CommandPage,
} from "peal-ui/components/command";
import { Kbd, KbdSequence } from "peal-ui/components/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "peal-ui/components/tooltip";
import { useState } from "react";
import type { ComponentProps, ComponentType, ReactNode } from "react";

import type {
  CommandScope,
  MenuRequest,
  PageCommand,
} from "#components/shell/command-scope.tsx";
import { pageIcons } from "#components/shell/sidebar-view.tsx";
import {
  commandMenuKey,
  goKeys,
  newPostKey,
  shortcutSheetKey,
} from "#shell/keys.ts";
import type { PageLink } from "#shell/navigation.ts";

/** A link of the app, which the container makes from next-intl's. */
export type MenuLink = ComponentType<
  ComponentProps<"a"> & { readonly href: string }
>;

// The documentation and support open in a tab of their own.
const OutsideLink: MenuLink = ({ children, ...props }) => (
  <a {...props} target="_blank" rel="noreferrer">
    {children}
  </a>
);

type Group = "api" | "goTo" | "posts" | "settings";

const groupOf = ({ mode, section }: PageLink): Group => {
  if (mode === "api") {
    return "api";
  }

  return section ?? "goTo";
};

const groups: readonly Group[] = ["goTo", "posts", "settings", "api"];

const noKeywords: readonly string[] = [];

/** One command: a link, its icon, its name and its keys. */
const MenuItem = ({
  href,
  icon: Icon,
  keys = null,
  keywords = noKeywords,
  label,
  link: Link,
}: {
  readonly href: string;
  readonly icon: LucideIcon;
  readonly keys?: ReactNode;
  /** More words that find it: its group's name, so "settings" finds them all. */
  readonly keywords?: readonly string[];
  readonly label: string;
  readonly link: MenuLink;
}) => (
  <CommandItem
    value={href}
    label={label}
    keywords={[...keywords]}
    render={<Link href={href} />}
  >
    <CommandItemIcon>
      <Icon />
    </CommandItemIcon>
    <CommandItemText>{label}</CommandItemText>
    {keys}
  </CommandItem>
);

/** A command the open page offers: a link, or an action it runs. */
const PageCommandItem = ({
  command,
  link,
}: {
  readonly command: PageCommand;
  readonly link: MenuLink;
}) => {
  if ("href" in command) {
    return (
      <MenuItem
        href={command.href}
        icon={command.icon}
        keywords={command.keywords ?? noKeywords}
        label={command.label}
        link={command.outside === true ? OutsideLink : link}
      />
    );
  }

  const Icon = command.icon;
  const page = pageOf(command);

  const keys =
    command.keys === undefined ? null : <KeyHint keys={command.keys} />;

  if (page !== null) {
    return (
      <CommandItem
        value={page}
        page={page}
        label={command.label}
        keywords={[...(command.keywords ?? noKeywords)]}
      >
        <CommandItemIcon>
          <Icon />
        </CommandItemIcon>
        <CommandItemText>{command.label}</CommandItemText>
        {keys}
      </CommandItem>
    );
  }

  return (
    <CommandItem
      value={`page:${command.id}`}
      label={command.label}
      keywords={[...(command.keywords ?? noKeywords)]}
      onSelect={async () => {
        if ("run" in command) {
          await command.run();
        }
      }}
    >
      <CommandItemIcon>
        <Icon />
      </CommandItemIcon>
      <CommandItemText>{command.label}</CommandItemText>
      {keys}
    </CommandItem>
  );
};

/** A command's key, as the platform writes it. */
const KeyHint = ({ keys }: { readonly keys: string }) => {
  const hint = useShortcutHint(keys);

  return (
    <CommandKeys>
      <Kbd>{hint.text}</Kbd>
    </CommandKeys>
  );
};

/** The menu's page of a command with one: a question's or a choice's. */
const pageOf = (command: PageCommand): string | null => {
  if ("ask" in command) {
    return questionPage(command.id);
  }

  return "choose" in command ? `choose:${command.id}` : null;
};

/** A choice's page: its options, which the text typed narrows. */
const ChoiceItems = ({
  command,
}: {
  readonly command: Extract<PageCommand, { readonly choose: unknown }>;
}) => (
  <CommandGroup aria-label={command.label}>
    {command.choose.options.map((option) => (
      <CommandItem
        key={option.id}
        value={`choice:${command.id}:${option.id}`}
        label={option.label}
        onSelect={async () => {
          await option.run();
        }}
      >
        {option.checked === undefined ? null : (
          <CommandItemCheck checked={option.checked} />
        )}
        {option.mark === undefined ? null : (
          <CommandItemIcon>{option.mark}</CommandItemIcon>
        )}
        <CommandItemText>{option.label}</CommandItemText>
      </CommandItem>
    ))}
  </CommandGroup>
);

/** The menu's page where a question's text is typed. */
const questionPage = (id: string) => `ask:${id}`;

/**
 * A question's page: one line, what the text typed would do, which Enter
 * runs; or why it cannot, or the hint while the text answers nothing. The
 * menu does not filter a question's page, so the line always shows.
 */
const AnswerItem = ({
  command,
  query,
}: {
  readonly command: Extract<PageCommand, { readonly ask: unknown }>;
  readonly query: string;
}) => {
  const answer = query.trim() === "" ? null : command.ask.answer(query);
  const Icon = command.icon;
  const run = answer?.run;

  return (
    <CommandItem
      value={`answer:${command.id}`}
      label={answer?.label ?? command.ask.hint}
      disabled={run === undefined}
      onSelect={async () => {
        await run?.();
      }}
    >
      <CommandItemIcon>
        <Icon />
      </CommandItemIcon>
      <span className="min-w-0 truncate">
        {answer?.label ?? command.ask.hint}
      </span>
      {answer?.detail === undefined ? null : (
        <CommandItemHint>{answer.detail}</CommandItemHint>
      )}
    </CommandItem>
  );
};

/**
 * The menu's text, its pages and whether the page's commands show, and
 * what they hold: the open page's questions and choices, the one whose
 * page is open, and the pages that choosing a command opens. A new request
 * starts the menu again where it asks.
 */
const useMenuPages = (scope: CommandScope | null, request: MenuRequest) => {
  const [query, setQuery] = useState("");
  // Backspace in the empty field takes the page's commands out, as the
  // chip says; opening the menu again brings them back.
  const [scoped, setScoped] = useState(true);
  // The menu's pages, from the first one opened: a question's or a choice's.
  const [stack, setStack] = useState<string[]>([]);
  // The request already answered.
  const [answered, setAnswered] = useState(request.count);

  const restart = (page: string | null) => {
    setScoped(true);
    setQuery("");
    setStack(page === null ? [] : [page]);
  };

  if (request.count !== answered) {
    setAnswered(request.count);

    const wanted = scope?.commands.find(({ id }) => id === request.command);

    restart(wanted === undefined ? null : pageOf(wanted));
  }

  const shownScope = scoped ? scope : null;
  const commands = shownScope?.commands ?? [];

  const questions = commands.flatMap((command) =>
    "ask" in command ? [command] : []
  );

  const choices = commands.flatMap((command) =>
    "choose" in command ? [command] : []
  );

  return {
    asked: questions.find(({ id }) => questionPage(id) === stack.at(-1)),
    choices,
    chosen: choices.find((command) => pageOf(command) === stack.at(-1)),
    // Choosing a command with a page of its own keeps the menu open.
    commandPages: new Set(commands.flatMap((command) => pageOf(command) ?? [])),
    query,
    questions,
    restart,
    setQuery,
    setScoped,
    setStack,
    shownScope,
    stack,
  };
};

/**
 * The command menu (DESIGN.md, "Command menu"): the top bar's button, and
 * the dialog it and ⌘K open, to create, to open any page the member may,
 * another workspace, the documentation or support. A command closes it.
 */
export const CommandMenuView = ({
  docsUrl,
  link,
  newPostHref,
  onOpenChange,
  onShortcuts,
  open,
  pages,
  postFilters,
  request,
  scope,
  supportUrl,
  workspaces,
}: {
  readonly docsUrl: string | null;
  readonly link: MenuLink;
  /** Where a new post starts, or null for a member who may not write one. */
  readonly newPostHref: string | null;
  readonly onOpenChange: (open: boolean) => void;
  /** Opens the sheet of every shortcut. */
  readonly onShortcuts: () => void;
  readonly open: boolean;
  readonly pages: readonly PageLink[];
  /** The posts list narrowed to a state, listed with the Posts pages. */
  readonly postFilters: readonly {
    readonly href: string;
    readonly label: string;
  }[];
  /** The page's latest wish to open the menu, maybe on a command's page. */
  readonly request: MenuRequest;
  /** What the open page offers about what it shows, listed first. */
  readonly scope: CommandScope | null;
  readonly supportUrl: string | null;
  /** The member's other workspaces, each with where it opens. */
  readonly workspaces: readonly {
    readonly href: string;
    readonly id: string;
    readonly name: string;
  }[];
}) => {
  const t = useTranslations("CommandMenu");
  const shell = useTranslations("WorkspaceShell");
  const hint = useShortcutHint(commandMenuKey);

  const {
    asked,
    choices,
    chosen,
    commandPages,
    query,
    questions,
    restart,
    setQuery,
    setScoped,
    setStack,
    shownScope,
    stack,
  } = useMenuPages(scope, request);

  const changeOpen = (next: boolean) => {
    if (next) {
      restart(null);
    }

    onOpenChange(next);
  };

  const groupNames: Readonly<Record<Group, string>> = {
    api: shell("modes.api"),
    goTo: t("groups.goTo"),
    posts: shell("sections.posts"),
    settings: shell("sections.settings"),
  };

  const sequence = (key: string | undefined) =>
    key === undefined ? null : (
      <CommandKeys>
        <KbdSequence keys={["g", key]} then={t("then")} />
      </CommandKeys>
    );

  return (
    <CommandDialog open={open} onOpenChange={changeOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <CommandDialogIconTrigger
              shortcut={commandMenuKey}
              aria-label={t("trigger")}
            />
          }
        >
          <SearchIcon aria-hidden />
        </TooltipTrigger>
        <TooltipContent>
          {t("search")} {hint.text}
        </TooltipContent>
      </Tooltip>
      <CommandDialogContent title={t("title")}>
        <Command
          loop
          query={query}
          onQueryChange={setQuery}
          pages={stack}
          filter={asked === undefined ? "fuzzy" : false}
          onPagesChange={setStack}
          onAction={(value) => {
            // Choosing a question or a choice opens its page; anything
            // else is done.
            if (!commandPages.has(value)) {
              onOpenChange(false);
            }
          }}
        >
          <CommandInput
            aria-label={asked?.label ?? chosen?.label ?? t("inputLabel")}
            placeholder={
              asked?.ask.placeholder ??
              chosen?.choose.placeholder ??
              t("placeholder")
            }
            before={
              shownScope === null ? null : (
                <CommandChip>{shownScope.label}</CommandChip>
              )
            }
            onKeyDown={(event) => {
              // On the first page, Backspace in the empty field takes the
              // chip out; on a question's, it goes back, as ui-sdk does.
              if (
                event.key === "Backspace" &&
                query === "" &&
                stack.length === 0 &&
                shownScope !== null
              ) {
                event.preventDefault();
                setScoped(false);
              }
            }}
          />
          <CommandEmpty>
            {(state) => t("empty", { query: state.query })}
          </CommandEmpty>
          <CommandList>
            {questions.map((command) => (
              <CommandPage key={command.id} value={questionPage(command.id)}>
                <AnswerItem command={command} query={query} />
              </CommandPage>
            ))}
            {choices.map((command) => (
              <CommandPage key={command.id} value={pageOf(command) ?? ""}>
                <ChoiceItems command={command} />
              </CommandPage>
            ))}
            <CommandPage>
              {shownScope === null ||
              shownScope.commands.length === 0 ? null : (
                <CommandGroup>
                  <CommandGroupLabel>{shownScope.heading}</CommandGroupLabel>
                  {shownScope.commands.map((command) => (
                    <PageCommandItem
                      key={command.id}
                      command={command}
                      link={link}
                    />
                  ))}
                </CommandGroup>
              )}
              {newPostHref === null ? null : (
                <CommandGroup>
                  <CommandGroupLabel>{t("groups.create")}</CommandGroupLabel>
                  <MenuItem
                    href={newPostHref}
                    icon={PlusIcon}
                    keys={
                      <CommandKeys>
                        <Kbd>{newPostKey.toUpperCase()}</Kbd>
                      </CommandKeys>
                    }
                    label={t("newPost")}
                    link={link}
                  />
                </CommandGroup>
              )}
              {groups.map((group) => {
                const links = pages.filter((page) => groupOf(page) === group);

                return links.length === 0 ? null : (
                  <CommandGroup key={group}>
                    <CommandGroupLabel>{groupNames[group]}</CommandGroupLabel>
                    {links.map((page) => (
                      <MenuItem
                        key={page.href}
                        href={page.href}
                        icon={pageIcons[page.page]}
                        keys={sequence(goKeys[page.page])}
                        keywords={group === "goTo" ? [] : [groupNames[group]]}
                        label={shell(`pages.${page.page}`)}
                        link={link}
                      />
                    ))}
                    {group === "posts"
                      ? postFilters.map((filter) => (
                          <MenuItem
                            key={filter.href}
                            href={filter.href}
                            icon={ListFilterIcon}
                            keywords={[groupNames.posts]}
                            label={filter.label}
                            link={link}
                          />
                        ))
                      : null}
                  </CommandGroup>
                );
              })}
              {workspaces.length === 0 ? null : (
                <CommandGroup>
                  <CommandGroupLabel>
                    {t("groups.workspaces")}
                  </CommandGroupLabel>
                  {workspaces.map((workspace) => (
                    <MenuItem
                      key={workspace.id}
                      href={workspace.href}
                      icon={ArrowLeftRightIcon}
                      label={t("switchTo", { workspace: workspace.name })}
                      link={link}
                    />
                  ))}
                </CommandGroup>
              )}
              <CommandGroup>
                <CommandGroupLabel>{t("groups.help")}</CommandGroupLabel>
                <CommandItem
                  value="help:shortcuts"
                  label={t("shortcuts")}
                  onSelect={onShortcuts}
                >
                  <CommandItemIcon>
                    <KeyboardIcon />
                  </CommandItemIcon>
                  <CommandItemText>{t("shortcuts")}</CommandItemText>
                  <KeyHint keys={shortcutSheetKey} />
                </CommandItem>
                {docsUrl === null ? null : (
                  <MenuItem
                    href={docsUrl}
                    icon={BookOpenIcon}
                    label={shell("docs")}
                    link={OutsideLink}
                  />
                )}
                {supportUrl === null ? null : (
                  <MenuItem
                    href={supportUrl}
                    icon={LifeBuoyIcon}
                    label={shell("support")}
                    link={OutsideLink}
                  />
                )}
              </CommandGroup>
            </CommandPage>
          </CommandList>
          <CommandFooter>
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              {t("footer.move")}
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd>
              {t("footer.open")}
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>esc</Kbd>
              {t("footer.close")}
            </span>
          </CommandFooter>
        </Command>
      </CommandDialogContent>
    </CommandDialog>
  );
};
