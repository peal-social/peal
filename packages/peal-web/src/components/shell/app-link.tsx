"use client";

import type { LinkComponent } from "#components/shell/sidebar-view.tsx";
import { Link } from "#i18n/navigation.ts";

/** The app's link, in the reader's language, for views that take one. */
export const AppLink: LinkComponent = ({ children, ...props }) => (
  <Link {...props}>{children}</Link>
);
