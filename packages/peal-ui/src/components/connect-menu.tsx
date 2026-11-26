"use client";

import { announce } from "@ui-sdk/core";
import {
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { Cta } from "../lib/site/measurement/events";
import { cn } from "../lib/utils";
import { buttonVariants } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Mark } from "./site-icons";
import type { SiteMark } from "./site-icons";

/**
 * An AI client Peal connects to, and the page that says how: its mark in
 * ink, or the address of its own icon where its logo exists in colour only.
 */
type ConnectClient = {
  readonly href: string;
  /** The call to action a click on it counts as, where the site measures. */
  readonly measure?: Cta | undefined;
  readonly name: string;
} & (
  | { readonly icon?: undefined; readonly mark: SiteMark }
  | { readonly icon: string; readonly mark?: undefined }
);

// A client's mark, or its own icon in its colours, at 16 px.
const ClientIcon = ({
  className,
  client,
}: {
  readonly className?: string | undefined;
  readonly client: ConnectClient;
}) =>
  client.icon === undefined ? (
    <Mark mark={client.mark} className={className} />
  ) : (
    <img
      src={client.icon}
      alt=""
      width={16}
      height={16}
      className={cn("size-4 shrink-0 object-contain", className)}
    />
  );

/** A prompt any agent can follow to set Peal up, and its item's words. */
interface ConnectSetup {
  /** The item's label once it copied, also announced. */
  readonly copied: string;
  readonly label: string;
  readonly prompt: string;
}

interface ConnectMenuProps {
  readonly className?: string | undefined;
  readonly clients: readonly ConnectClient[];
  /** The button's words, such as "Connect Peal". */
  readonly label: string;
  /** Where the site counts the clicks, such as the hero. */
  readonly place: "hero";
  readonly setup?: ConnectSetup | undefined;
}

// The last item: copies the prompt and says so for two seconds, the menu
// still open, so the reader sees it worked.
const SetupItem = ({ setup }: { readonly setup: ConnectSetup }) => {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = done
      ? setTimeout(() => {
          setDone(false);
        }, 2000)
      : undefined;

    return () => {
      clearTimeout(timer);
    };
  }, [done]);

  return (
    <DropdownMenuItem
      closeOnSelect={false}
      label={setup.label}
      className="gap-2.5 py-1.5"
      onSelect={async () => {
        try {
          await navigator.clipboard.writeText(setup.prompt);
        } catch {
          // The browser refused the clipboard: nothing was copied.
          return;
        }

        setDone(true);
        announce(setup.copied);
      }}
    >
      <span className="flex size-7 items-center justify-center">
        {done ? (
          <CheckIcon aria-hidden="true" strokeWidth={1.75} />
        ) : (
          <CopyIcon aria-hidden="true" strokeWidth={1.75} />
        )}
      </span>
      {done ? setup.copied : setup.label}
    </DropdownMenuItem>
  );
};

/**
 * The hero's second button (DESIGN.md, Site): an outline button with the
 * first clients' marks, its label and a chevron, opening a menu of the AI
 * clients Peal connects to, each with its mark or its own icon in a
 * bordered tile and an arrow pointing out, then an item that copies a
 * setup prompt for any agent.
 */
const ConnectMenu = ({
  className,
  clients,
  label,
  place,
  setup,
}: ConnectMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      className={buttonVariants({
        className: cn("gap-2", className),
        variant: "outline",
      })}
    >
      <span aria-hidden="true" className="flex items-center gap-1">
        {clients.slice(0, 3).map((client) => (
          <ClientIcon
            key={client.name}
            client={client}
            className="text-foreground size-3.5"
          />
        ))}
      </span>
      {label}
      <ChevronDownIcon
        aria-hidden="true"
        strokeWidth={1.75}
        className="text-muted-foreground size-4"
      />
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="center"
      sideOffset={6}
      className="w-auto min-w-60 text-start"
    >
      {clients.map((client) => (
        <DropdownMenuItem
          key={client.name}
          label={client.name}
          className="gap-2.5 py-1.5"
          render={
            <a
              href={client.href}
              data-measure-cta={client.measure}
              data-measure-place={
                client.measure === undefined ? undefined : place
              }
            >
              <span className="bg-card text-foreground flex size-7 items-center justify-center rounded-md border">
                <ClientIcon client={client} />
              </span>
              <span className="flex-1">{client.name}</span>
              <ArrowUpRightIcon
                aria-hidden="true"
                strokeWidth={1.75}
                className="text-muted-foreground"
              />
            </a>
          }
        />
      ))}
      {setup === undefined ? null : (
        <>
          <DropdownMenuSeparator />
          <SetupItem setup={setup} />
        </>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);

export { ConnectMenu };

export type { ConnectClient, ConnectMenuProps, ConnectSetup };
