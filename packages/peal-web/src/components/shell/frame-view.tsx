"use client";

import {
  BookOpenIcon,
  BotIcon,
  CircleHelpIcon,
  HistoryIcon,
  KeyboardIcon,
  LifeBuoyIcon,
  MenuIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "peal-ui/components/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "peal-ui/components/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "peal-ui/components/tooltip";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { useShortcutSheet } from "#components/shell/command-scope.tsx";

// What a sidebar's link calls once followed: it closes the sheet that
// holds the sidebar on a phone, and does nothing beside the page.
const CloseMenu = createContext<() => void>(() => {
  // Beside the page, there is no sheet to close.
});

/** What to call when a sidebar's link is followed. */
export const useCloseMenu = (): (() => void) => use(CloseMenu);

// Where a page puts its actions, and how it names itself, in the panel's
// header.
interface Header {
  readonly actions: HTMLElement | null;
  readonly setTitle: (title: string | null) => void;
}

const PanelHeader = createContext<Header>({
  actions: null,
  setTitle: () => {
    // Outside the frame, a page has no header to name.
  },
});

/**
 * A page's actions, at the end of the panel's header (DESIGN.md, "The
 * frame"): small ghost buttons, such as "+ New post".
 */
export const PageActions = ({ children }: { readonly children: ReactNode }) => {
  const { actions } = use(PanelHeader);

  return actions === null ? null : createPortal(children, actions);
};

/**
 * The page's name in the panel's header, where it is not the sidebar's
 * name for the page: a post's, a conversation's.
 */
export const PageTitle = ({ children }: { readonly children: string }) => {
  const { setTitle } = use(PanelHeader);

  useEffect(() => {
    setTitle(children);

    return () => {
      setTitle(null);
    };
  }, [children, setTitle]);

  return null;
};

// Help, at the sidebar's foot: the documentation, support, and the
// shortcut sheet where the frame has one.
const HelpMenu = ({
  docsUrl,
  supportUrl,
}: {
  readonly docsUrl: string | null;
  readonly supportUrl: string | null;
}) => {
  const t = useTranslations("WorkspaceShell");
  const sheet = useShortcutSheet();

  if (docsUrl === null && supportUrl === null && !sheet.present) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={t("help")} />
        }
      >
        <CircleHelpIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">
        {docsUrl === null ? null : (
          <DropdownMenuItem
            render={
              <a href={docsUrl} target="_blank" rel="noreferrer">
                <BookOpenIcon aria-hidden />
                {t("docs")}
              </a>
            }
          />
        )}
        {supportUrl === null ? null : (
          <DropdownMenuItem
            render={
              <a href={supportUrl} target="_blank" rel="noreferrer">
                <LifeBuoyIcon aria-hidden />
                {t("support")}
              </a>
            }
          />
        )}
        {sheet.present ? (
          <DropdownMenuItem
            onClick={() => {
              sheet.setOpen(true);
            }}
          >
            <KeyboardIcon aria-hidden />
            {t("shortcuts")}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// The agent's place at the bottom bar's end, as in the list it comes from:
// shown already, off until the agent is built.
const AgentButtons = () => {
  const t = useTranslations("WorkspaceShell");

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="ghost" size="sm" disabled focusableWhenDisabled />
          }
        >
          <BotIcon aria-hidden />
          {t("agent")}
        </TooltipTrigger>
        <TooltipContent>{t("agentSoon")}</TooltipContent>
      </Tooltip>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled
        aria-label={t("history")}
        title={t("agentSoon")}
      >
        <HistoryIcon aria-hidden />
      </Button>
    </>
  );
};

/**
 * The signed-in app's frame (DESIGN.md, "The frame"): the
 * sidebar on the page's background and the page in a white panel beside
 * it, under a header naming it (the breadcrumb, the page's `h1`) with the
 * page's actions at its end; then a bar across the window's foot, the
 * account at its start (`actions`), Help and the agent's place at its end.
 * On a phone the sidebar is a sheet the header's menu button opens; its
 * links close it through `useCloseMenu`.
 */
export const FrameView = ({
  actions,
  breadcrumb,
  children,
  docsUrl,
  footer,
  label,
  sidebar,
  supportUrl,
}: {
  /** The account menu, at the bottom bar's start. */
  readonly actions: ReactNode;
  readonly breadcrumb: {
    readonly section: string | null;
    readonly page: string | null;
  };
  readonly children: ReactNode;
  readonly docsUrl: string | null;
  /** What every page ends with: the contract functions. */
  readonly footer: ReactNode;
  /** The sidebar's name, for the sheet that holds it on a phone. */
  readonly label: string;
  readonly sidebar: ReactNode;
  readonly supportUrl: string | null;
}) => {
  const t = useTranslations("WorkspaceShell");
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const [title, setTitle] = useState<string | null>(null);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const header = useMemo(
    () => ({ actions: actionsSlot, setTitle }),
    [actionsSlot]
  );

  const shownTitle = title ?? breadcrumb.page;

  return (
    <PanelHeader value={header}>
      <div className="bg-background flex h-svh flex-col">
        <div className="flex min-h-0 flex-1">
          <div className="hidden shrink-0 flex-col md:flex">
            <div className="min-h-0 flex-1">{sidebar}</div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col md:pt-2 md:pr-2">
            <div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden md:rounded-xl md:border">
              <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:px-4">
                <Sheet open={menuOpen} onOpenChange={setMenuOpen} side="left">
                  <SheetTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="md:hidden"
                        aria-label={t("openMenu")}
                      />
                    }
                  >
                    <MenuIcon aria-hidden />
                  </SheetTrigger>
                  {/* Closed by Escape or a tap beside it: a corner button
                    would sit on the sidebar's head. */}
                  <SheetContent>
                    <SheetTitle className="sr-only">{label}</SheetTitle>
                    <CloseMenu value={closeMenu}>
                      <div className="flex min-h-0 flex-1 flex-col">
                        {sidebar}
                      </div>
                    </CloseMenu>
                  </SheetContent>
                </Sheet>
                <nav aria-label={t("breadcrumb")} className="min-w-0 flex-1">
                  <ol className="flex items-center gap-1.5 text-sm">
                    {breadcrumb.section === null ? null : (
                      <li className="text-muted-foreground flex items-center gap-1.5">
                        {breadcrumb.section}
                        <span aria-hidden className="text-muted-foreground/60">
                          ›
                        </span>
                      </li>
                    )}
                    {shownTitle === null ? null : (
                      <li aria-current="page" className="min-w-0">
                        <h1 className="truncate text-sm font-medium">
                          {shownTitle}
                        </h1>
                      </li>
                    )}
                  </ol>
                </nav>
                <div
                  ref={setActionsSlot}
                  className="flex shrink-0 items-center gap-1"
                />
              </header>
              <main className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
                  {children}
                </div>
                <footer className="text-muted-foreground px-4 pt-2 pb-6 text-xs md:px-6">
                  {footer}
                </footer>
              </main>
            </div>
          </div>
        </div>
        <div className="flex h-11 shrink-0 items-center">
          <div className="flex items-center px-2.5 md:w-60">{actions}</div>
          <div className="flex flex-1 items-center justify-end gap-1 pr-2.5">
            <HelpMenu docsUrl={docsUrl} supportUrl={supportUrl} />
            <AgentButtons />
          </div>
        </div>
      </div>
    </PanelHeader>
  );
};
