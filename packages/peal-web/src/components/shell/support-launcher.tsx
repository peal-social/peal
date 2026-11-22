"use client";

import { supportAttributes } from "peal-ui/lib/support/settings";
import type { SupportPerson } from "peal-ui/lib/support/settings";
import { useEffect, useRef } from "react";

// Defines `<peal-support>` once, apart from the page's first script.
const loadLauncher = () => {
  void import("peal-ui/lib/support/element");
};

/**
 * The support chat's launcher at the bottom bar's end (DESIGN.md, "Support
 * chat"): peal-ui's `<peal-support>`, which loads Crisp only once pressed
 * and names the signed-in person and their workspace to Peal's team. The
 * element is made here rather than in JSX, so React never re-creates it;
 * it starts once its attributes name the website.
 */
export const SupportLauncher = ({
  locale,
  person,
  websiteId,
}: {
  readonly locale: string;
  readonly person: SupportPerson;
  readonly websiteId: string;
}) => {
  const host = useRef<HTMLSpanElement>(null);
  const launcher = useRef<HTMLElement | null>(null);
  const { email, name, userId, workspaceId } = person;

  useEffect(() => {
    const made = document.createElement("peal-support");
    host.current?.append(made);
    launcher.current = made;
    loadLauncher();

    return () => {
      made.remove();
      launcher.current = null;
    };
  }, []);

  useEffect(() => {
    const made = launcher.current;

    if (made === null) {
      return;
    }

    const attributes = supportAttributes(websiteId, {
      locale,
      person: { email, name, userId, workspaceId },
      placement: "menu",
      source: "app",
    });

    for (const [attribute, value] of Object.entries(attributes)) {
      if (value === undefined) {
        made.removeAttribute(attribute);
      } else {
        made.setAttribute(attribute, value);
      }
    }
  }, [email, locale, name, userId, websiteId, workspaceId]);

  return <span ref={host} className="contents" />;
};
