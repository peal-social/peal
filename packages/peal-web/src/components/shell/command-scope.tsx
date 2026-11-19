"use client";

import type { LucideIcon } from "lucide-react";
import {
  createContext,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

/**
 * What a question's text would do, as the menu shows it before Enter:
 * `run` does it; without `run`, the line says why it cannot.
 */
export interface PageAnswer {
  readonly label: string;
  /** Beside the label, in muted text: how far off, for a date. */
  readonly detail?: string;
  readonly run?: () => Promise<void>;
}

/** A question: the text typed on its page answers it. */
export interface PageQuestion {
  readonly placeholder: string;
  /** Shown while the text answers nothing. */
  readonly hint: string;
  readonly answer: (text: string) => PageAnswer | null;
}

/** One option of a choice: a tag to add, which `run` does. */
export interface PageChoice {
  readonly id: string;
  readonly label: string;
  /** Before the label, like a tag's dot. */
  readonly mark?: ReactNode;
  /**
   * For an option that is on or off, as a checkbox: whether it is on, for
   * all of what it acts on (`true`) or some (`mixed`).
   */
  readonly checked?: boolean | "mixed";
  readonly run: () => Promise<void> | void;
}

/** A choice: a page of the menu listing its options, which typing narrows. */
export interface PageChoices {
  readonly placeholder: string;
  readonly options: readonly PageChoice[];
}

/**
 * A command a page offers about what it shows: a link (`href`, in a tab of
 * its own when `outside`), an action (`run`), which the menu marks pending
 * while its promise runs, a question (`ask`), which opens a page of the
 * menu where what is typed is the answer, or a choice (`choose`), which
 * opens a page of its options.
 */
export type PageCommand = {
  readonly id: string;
  readonly icon: LucideIcon;
  readonly label: string;
  /** More words that find it. */
  readonly keywords?: readonly string[];
  /** The key that does it on the page, shown beside it (ui-sdk's form). */
  readonly keys?: string;
} & (
  | { readonly href: string; readonly outside?: boolean }
  | { readonly run: () => Promise<void> | void }
  | { readonly ask: PageQuestion }
  | { readonly choose: PageChoices }
);

/**
 * What the open page is about: `label` names it in the command menu's
 * chip ("A launch post…", "3 posts"), `heading` heads its commands ("This
 * post").
 */
export interface CommandScope {
  readonly label: string;
  readonly heading: string;
  readonly commands: readonly PageCommand[];
}

/**
 * A page's wish to open the command menu: on its first page (`command`
 * null), or on a command's own page, a question's or a choice's. `count`
 * tells one wish from the next.
 */
export interface MenuRequest {
  readonly command: string | null;
  readonly count: number;
}

interface ScopeStore {
  readonly scope: CommandScope | null;
  readonly offer: (scope: CommandScope | null) => void;
  readonly request: MenuRequest;
  readonly openMenu: (command: string | null) => void;
  /** Whether the shortcut sheet shows, which ⌘/ and Help open. */
  readonly sheetOpen: boolean;
  readonly setSheetOpen: (
    open: boolean | ((shown: boolean) => boolean)
  ) => void;
  /** Whether a workspace's frame holds the menu and the sheet. */
  readonly present: boolean;
}

const noRequest: MenuRequest = { command: null, count: 0 };

const Scope = createContext<ScopeStore>({
  offer: () => {
    // Outside a workspace's frame, no menu lists a page's commands.
  },
  openMenu: () => {
    // Nor opens.
  },
  present: false,
  request: noRequest,
  scope: null,
  setSheetOpen: () => {
    // Nor is there a sheet.
  },
  sheetOpen: false,
});

/** Holds the commands the open page offers, for the command menu. */
export const CommandScopeProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const [scope, setScope] = useState<CommandScope | null>(null);
  const [request, setRequest] = useState(noRequest);
  const [sheetOpen, setSheetOpen] = useState(false);

  const store = useMemo(
    () => ({
      offer: setScope,
      openMenu: (command: string | null) => {
        setRequest(({ count }) => ({ command, count: count + 1 }));
      },
      present: true,
      request,
      scope,
      setSheetOpen,
      sheetOpen,
    }),
    [request, scope, sheetOpen]
  );

  return <Scope value={store}>{children}</Scope>;
};

/** The commands the open page offers, or null. */
export const useCommandScope = (): CommandScope | null => use(Scope).scope;

/**
 * The shortcut sheet's state: whether it shows, how to show it, and
 * whether this frame has one at all (`present`).
 */
export const useShortcutSheet = () => {
  const { present, setSheetOpen, sheetOpen } = use(Scope);

  return { open: sheetOpen, present, setOpen: setSheetOpen };
};

/** The latest wish to open the menu, for the menu. */
export const useMenuRequest = (): MenuRequest => use(Scope).request;

/**
 * Opens the command menu: on its first page, or on the page of one of the
 * page's commands, by its id.
 */
export const useOpenCommandMenu = (): ((command: string | null) => void) =>
  use(Scope).openMenu;

// A scope is offered again only when what the menu shows of it changes:
// its name and its commands' names, keys, addresses and options.
const signatureOf = (scope: CommandScope | null): string =>
  scope === null
    ? ""
    : [
        scope.label,
        scope.heading,
        ...scope.commands.map((command) =>
          [
            command.id,
            command.label,
            command.keys ?? "",
            "href" in command ? command.href : "",
            "choose" in command
              ? command.choose.options
                  .map(
                    ({ checked, id, label }) =>
                      `${id}:${label}:${String(checked ?? "")}`
                  )
                  .join(",")
              : "",
          ].join(" ")
        ),
      ].join("\n");

// The menu's copy of a command, whose action, answers and options are the
// latest render's, which `latestOf` finds.
const liveCommand = (
  command: PageCommand,
  latestOf: () => PageCommand | undefined
): PageCommand => {
  if ("run" in command) {
    return {
      ...command,
      run: async () => {
        const found = latestOf();

        if (found !== undefined && "run" in found) {
          await found.run();
        }
      },
    };
  }

  if ("ask" in command) {
    return {
      ...command,
      ask: {
        ...command.ask,
        answer: (text) => {
          const found = latestOf();

          return found !== undefined && "ask" in found
            ? found.ask.answer(text)
            : null;
        },
      },
    };
  }

  if ("choose" in command) {
    return {
      ...command,
      choose: {
        ...command.choose,
        options: command.choose.options.map((option) => ({
          ...option,
          run: async () => {
            const found = latestOf();

            if (found !== undefined && "choose" in found) {
              await found.choose.options
                .find(({ id }) => id === option.id)
                ?.run();
            }
          },
        })),
      },
    };
  }

  return command;
};

/**
 * Offers the command menu commands about what the page shows, while the
 * page is open. An action runs the handler of the latest render.
 */
export const usePageCommands = (scope: CommandScope | null): void => {
  const { offer } = use(Scope);
  const latest = useRef(scope);
  const signature = signatureOf(scope);

  useEffect(() => {
    latest.current = scope;
  });

  // The signature alone decides when the menu's copy changes: an empty one
  // is no scope.
  useEffect(() => {
    const { current } = latest;

    const forget = () => {
      offer(null);
    };

    if (signature === "" || current === null) {
      forget();

      return forget;
    }

    offer({
      commands: current.commands.map((command) =>
        liveCommand(command, () =>
          latest.current?.commands.find(({ id }) => id === command.id)
        )
      ),
      heading: current.heading,
      label: current.label,
    });

    return forget;
  }, [offer, signature]);
};
