"use client";

import {
  Command as CommandPrimitive,
  CommandEmpty as CommandEmptyPrimitive,
  CommandGroup as CommandGroupPrimitive,
  CommandGroupLabel as CommandGroupLabelPrimitive,
  CommandInput as CommandInputPrimitive,
  CommandItem as CommandItemPrimitive,
  CommandItemIcon as CommandItemIconPrimitive,
  CommandItemText as CommandItemTextPrimitive,
  CommandList as CommandListPrimitive,
  CommandPage as CommandPagePrimitive,
  CommandSeparator as CommandSeparatorPrimitive,
  CommandShortcut as CommandShortcutPrimitive,
} from "@ui-sdk/react/command";
import {
  Dialog as DialogPrimitive,
  DialogBackdrop as DialogBackdropPrimitive,
  DialogContent as DialogContentPrimitive,
  DialogTitle as DialogTitlePrimitive,
  DialogTrigger as DialogTriggerPrimitive,
} from "@ui-sdk/react/dialog";
import { CheckIcon, MinusIcon, SearchIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils";
import { buttonVariants } from "./button";

type WithClassName<Props> = Omit<Props, "className"> & {
  readonly className?: string | undefined;
};

const Command = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof CommandPrimitive>>) => (
  <CommandPrimitive
    className={cn(
      "bg-popover text-popover-foreground flex size-full flex-col overflow-hidden",
      className
    )}
    {...props}
  />
);

/** The command menu's root: holds its trigger and its content. */
const CommandDialog = (props: React.ComponentProps<typeof DialogPrimitive>) => (
  <DialogPrimitive {...props} />
);

/**
 * The button that opens the command menu, as wide as its place: an outline
 * button whose text reads as a field's placeholder.
 */
const CommandDialogTrigger = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof DialogTriggerPrimitive>>) => (
  <DialogTriggerPrimitive
    className={cn(
      buttonVariants({ variant: "outline" }),
      "text-muted-foreground w-full justify-start px-2.5 font-normal",
      className
    )}
    {...props}
  />
);

/** The command menu's button as the search icon of the sidebar's head. */
const CommandDialogIconTrigger = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof DialogTriggerPrimitive>>) => (
  <DialogTriggerPrimitive
    className={cn(
      buttonVariants({ size: "icon-sm", variant: "ghost" }),
      "text-muted-foreground",
      className
    )}
    {...props}
  />
);

/**
 * The command menu over the page, a third of the way down, as wide as a
 * phone allows. `title` names it for screen readers; it is not shown.
 */
const CommandDialogContent = ({
  children,
  className,
  title,
  ...props
}: Omit<
  WithClassName<React.ComponentProps<typeof DialogContentPrimitive>>,
  "children"
> & {
  readonly children?: React.ReactNode;
  readonly title: string;
}) => (
  <>
    <DialogBackdropPrimitive className="fixed inset-0 isolate z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
    <DialogContentPrimitive
      className={cn(
        "bg-popover text-popover-foreground ring-foreground/10 fixed top-[16dvh] left-1/2 z-50 flex max-h-[76dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-xl shadow-lg ring-1 transition-[opacity,scale] duration-150 outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
        className
      )}
      {...props}
    >
      <DialogTitlePrimitive className="sr-only">{title}</DialogTitlePrimitive>
      {children}
    </DialogContentPrimitive>
  </>
);

/**
 * The search field, with its icon. `before` holds what narrows the menu
 * ahead of the text, like the item it acts on.
 */
const CommandInput = ({
  before,
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof CommandInputPrimitive>> & {
  readonly before?: React.ReactNode;
}) => (
  <div
    data-slot="command-input-wrapper"
    className="flex h-12 shrink-0 items-center gap-2 border-b px-3"
  >
    <SearchIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
    {before}
    <CommandInputPrimitive
      className={cn(
        "placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  </div>
);

const CommandList = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof CommandListPrimitive>>) => (
  <CommandListPrimitive
    className={cn(
      "min-h-0 flex-1 scroll-py-1 overflow-x-hidden overflow-y-auto p-1 outline-none",
      className
    )}
    {...props}
  />
);

const CommandEmpty = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof CommandEmptyPrimitive>>) => (
  <CommandEmptyPrimitive
    className={cn(
      "text-muted-foreground hidden px-3 py-8 text-center text-sm data-[empty]:block",
      className
    )}
    {...props}
  />
);

const CommandGroup = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof CommandGroupPrimitive>>) => (
  <CommandGroupPrimitive
    className={cn("not-first:mt-1", className)}
    {...props}
  />
);

const CommandGroupLabel = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof CommandGroupLabelPrimitive>>) => (
  <CommandGroupLabelPrimitive
    className={cn("text-muted-foreground px-2 pt-2 pb-1 text-xs", className)}
    {...props}
  />
);

const CommandItem = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof CommandItemPrimitive>>) => (
  <CommandItemPrimitive
    className={cn(
      "data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex h-8.5 cursor-default items-center gap-2 rounded-md px-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-pending:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  />
);

/**
 * A box before an option that is on, off or on for some of what it acts
 * on (`mixed`), drawn like a checkbox; the item itself is what is pressed.
 */
const CommandItemCheck = ({
  checked,
}: {
  readonly checked: boolean | "mixed";
}) => (
  <span
    aria-hidden
    data-slot="command-item-check"
    data-checked={checked === false ? undefined : ""}
    className="border-input data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground flex size-4 shrink-0 items-center justify-center rounded-[4px] border [&_svg]:size-3.5"
  >
    {checked === true ? <CheckIcon /> : null}
    {checked === "mixed" ? <MinusIcon /> : null}
  </span>
);

const CommandItemIcon = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof CommandItemIconPrimitive>>) => (
  <CommandItemIconPrimitive
    className={cn(
      "text-muted-foreground flex size-4 shrink-0 items-center justify-center data-mirror:rtl:-scale-x-100",
      className
    )}
    {...props}
  />
);

/** A command's name, its letters the search matched in a heavier weight. */
const CommandItemText = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof CommandItemTextPrimitive>>) => (
  <CommandItemTextPrimitive
    className={cn(
      "min-w-0 truncate [&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-inherit",
      className
    )}
    {...props}
  />
);

/** Beside a command's name, in muted text: where it is, or what it is. */
const CommandItemHint = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    data-slot="command-item-hint"
    className={cn("text-muted-foreground min-w-0 truncate", className)}
    {...props}
  />
);

/** A command's keys, at its end: its own shortcut, or other keys given. */
const CommandShortcut = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof CommandShortcutPrimitive>>) => (
  <CommandShortcutPrimitive
    className={cn(
      "bg-muted text-muted-foreground ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-sm px-1 font-mono text-xs",
      className
    )}
    {...props}
  />
);

/**
 * What ends an item, at its far end: the chevron of an item that opens a
 * page, or the check of a value chosen.
 */
const CommandItemEnd = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    data-slot="command-item-end"
    className={cn(
      "text-muted-foreground ml-auto flex shrink-0 items-center [&_svg]:size-4",
      className
    )}
    {...props}
  />
);

/** Keys of the app's own at a command's end, like a sequence. */
const CommandKeys = ({ className, ...props }: React.ComponentProps<"span">) => (
  <span
    data-slot="command-keys"
    aria-hidden
    className={cn("ml-auto flex shrink-0 items-center", className)}
    {...props}
  />
);

const CommandSeparator = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof CommandSeparatorPrimitive>>) => (
  <CommandSeparatorPrimitive
    className={cn("bg-border -mx-1 my-1 h-px", className)}
    {...props}
  />
);

/**
 * What the menu acts on, before the search text, like the post the page
 * shows: Backspace in the empty field takes it out.
 */
const CommandChip = ({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    data-slot="command-chip"
    className={cn(
      "bg-secondary text-secondary-foreground inline-flex h-6 max-w-48 shrink-0 items-center rounded-sm px-2 text-xs",
      className
    )}
    {...props}
  >
    <span className="truncate">{children}</span>
  </span>
);

/**
 * Commands shown while this page is on top: without `value`, the first
 * page. Renders no element.
 */
const CommandPage = (
  props: React.ComponentProps<typeof CommandPagePrimitive>
) => <CommandPagePrimitive {...props} />;

/** The menu's foot: the keys that move in it. */
const CommandFooter = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-slot="command-footer"
    aria-hidden
    className={cn(
      "text-muted-foreground flex h-9 shrink-0 items-center gap-4 border-t px-3 text-xs",
      className
    )}
    {...props}
  />
);

export {
  Command,
  CommandChip,
  CommandDialog,
  CommandDialogContent,
  CommandDialogIconTrigger,
  CommandDialogTrigger,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandItemCheck,
  CommandItemEnd,
  CommandItemHint,
  CommandItemIcon,
  CommandItemText,
  CommandKeys,
  CommandList,
  CommandPage,
  CommandSeparator,
  CommandShortcut,
};
