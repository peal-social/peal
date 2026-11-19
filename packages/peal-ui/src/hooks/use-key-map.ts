"use client";

import { registerShortcut } from "@ui-sdk/react/shortcuts";
import type { ShortcutOptions } from "@ui-sdk/react/shortcuts";
import { useEffect, useRef } from "react";

/**
 * A key, or two pressed one after the other (G then C), and what it does.
 * Keys are ui-sdk's (`"c"`, `"mod+k"`). `description` names it in the
 * reader's language, for a list of shortcuts.
 */
export interface KeyBinding {
  readonly keys: readonly [string] | readonly [string, string];
  readonly run: () => void;
  readonly description: string;
}

/** How long the second key of a sequence may wait for, in milliseconds. */
export const sequenceWaitMs = 1500;

/** What to register in ui-sdk's shortcuts for a set of bindings. */
export type Registration =
  | { readonly kind: "prefix"; readonly key: string }
  | { readonly kind: "single"; readonly key: string; readonly binding: number }
  | {
      readonly kind: "second";
      readonly prefix: string;
      readonly key: string;
      readonly binding: number;
    };

/** A binding's keys as one line, like "g c": what decides what is bound. */
export const sequenceOf = ({ keys }: KeyBinding): string => keys.join(" ");

/**
 * The registrations for bindings, given by their sequences in order: each
 * first key of a sequence once, then each binding, by its index. A key
 * that starts a sequence cannot run alone as well, which throws.
 */
export const registrationsOf = (
  sequences: readonly string[]
): readonly Registration[] => {
  const split = sequences.map((sequence) => sequence.split(" "));

  const prefixes = [
    ...new Set(
      split.flatMap(([first, second]) =>
        first !== undefined && second !== undefined ? [first] : []
      )
    ),
  ];

  const clash = split.find(
    ([first, second]) =>
      first !== undefined && second === undefined && prefixes.includes(first)
  );

  if (clash !== undefined) {
    throw new Error(
      `"${clash.join(" ")}" starts a sequence: it cannot run alone`
    );
  }

  return [
    ...prefixes.map((key): Registration => ({ key, kind: "prefix" })),
    ...split.flatMap(([first, second], binding): Registration[] => {
      if (first === undefined) {
        return [];
      }

      return second === undefined
        ? [{ binding, key: first, kind: "single" }]
        : [{ binding, key: second, kind: "second", prefix: first }];
    }),
  ];
};

/** The first key of a sequence that waits for its second, and since when. */
export interface Pending {
  readonly key: string;
  readonly since: number;
}

/** The first key still waiting at `now`, if any. */
export const waitingAt = (
  pending: Pending | null,
  now: number
): string | null =>
  pending !== null && now - pending.since < sequenceWaitMs ? pending.key : null;

/**
 * Binds keys and sequences on the page while the component is mounted,
 * through ui-sdk's shortcuts: none runs while focus is in a text field, and
 * a modal dialog pauses them. Bindings may change on every render; the
 * keys are bound again only when they change.
 */
export const useKeyMap = (bindings: readonly KeyBinding[]): void => {
  const latest = useRef(bindings);
  const sequences = bindings.map(sequenceOf).join("\n");

  useEffect(() => {
    latest.current = bindings;
  });

  useEffect(() => {
    let pending: Pending | null = null;

    const waiting = () => waitingAt(pending, Date.now());

    const run = (binding: number) => {
      pending = null;
      latest.current[binding]?.run();
    };

    const optionsOf = (binding: number, when: () => boolean) =>
      ({
        description: latest.current[binding]?.description ?? "",
        when,
      }) satisfies ShortcutOptions;

    const offs = registrationsOf(
      sequences === "" ? [] : sequences.split("\n")
    ).map((registration) => {
      if (registration.kind === "prefix") {
        return registerShortcut(registration.key, () => {
          pending = { key: registration.key, since: Date.now() };
        });
      }

      const when =
        registration.kind === "single"
          ? () => waiting() === null
          : () => waiting() === registration.prefix;

      return registerShortcut(
        registration.key,
        () => {
          run(registration.binding);
        },
        optionsOf(registration.binding, when)
      );
    });

    return () => {
      for (const off of offs) {
        off();
      }
    };
  }, [sequences]);
};
