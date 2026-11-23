import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * A settings page's column (DESIGN.md, "Settings"): 48 rem wide at most,
 * centred in the panel, its sections 32 px apart.
 */
const SettingsPage = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="settings-page"
    className={cn("mx-auto flex w-full max-w-3xl flex-col gap-8", className)}
    {...props}
  />
);

/** A group of settings: its heading, then its card, 12 px under it. */
const SettingsSection = ({
  className,
  ...props
}: React.ComponentProps<"section">) => (
  <section
    data-slot="settings-section"
    className={cn("flex flex-col gap-3", className)}
    {...props}
  />
);

/**
 * A section's heading: its title and one muted line, with what acts on the
 * whole section (New, Revoke all) at its end.
 */
const SettingsSectionHeader = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-slot="settings-section-header"
    className={cn(
      "flex flex-wrap items-end justify-between gap-x-4 gap-y-2",
      className
    )}
    {...props}
  />
);

const SettingsSectionTitle = ({
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"h2">, "children"> & {
  readonly children: React.ReactNode;
}) => (
  <h2
    data-slot="settings-section-title"
    className={cn("text-[15px] leading-snug font-semibold", className)}
    {...props}
  >
    {children}
  </h2>
);

const SettingsSectionDescription = ({
  className,
  ...props
}: React.ComponentProps<"p">) => (
  <p
    data-slot="settings-section-description"
    className={cn("text-muted-foreground mt-0.5 text-sm", className)}
    {...props}
  />
);

/**
 * The section's rows, in one white card cut by hairlines (DESIGN.md,
 * "`card`"): never a card a row.
 */
const SettingsCard = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="settings-card"
    className={cn(
      "bg-card text-card-foreground divide-border flex flex-col divide-y rounded-xl border text-sm",
      className
    )}
    {...props}
  />
);

/**
 * One setting: its label and hint at the start, its control at the end,
 * 12 by 16 px inside. On a phone the control takes a line of its own.
 */
const SettingsRow = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="settings-row"
    className={cn(
      "flex min-h-15 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
      className
    )}
    {...props}
  />
);

/** The label and hint of a row, which take the room the control leaves. */
const SettingsRowText = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-slot="settings-row-text"
    className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}
    {...props}
  />
);

/**
 * What the setting is, in 14 px, 500. With `htmlFor` it is the label of
 * the control at the row's end.
 */
const SettingsRowLabel = ({
  className,
  htmlFor,
  ...props
}: React.ComponentProps<"label">) =>
  htmlFor === undefined ? (
    <span
      data-slot="settings-row-label"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  ) : (
    <label
      htmlFor={htmlFor}
      data-slot="settings-row-label"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  );

/** The hint under a row's label, or a row's whole text when it is muted. */
const SettingsRowDescription = ({
  className,
  ...props
}: React.ComponentProps<"p">) => (
  <p
    data-slot="settings-row-description"
    className={cn("text-muted-foreground text-[13px] leading-snug", className)}
    {...props}
  />
);

/** The control at a row's end: a field, a select, a switch or buttons. */
const SettingsRowControl = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-slot="settings-row-control"
    className={cn(
      "flex shrink-0 flex-wrap items-center gap-2 sm:justify-end",
      className
    )}
    {...props}
  />
);

/**
 * A part of a card that is not a row, such as a form that opens under a
 * row or a list the section holds: 16 px inside.
 */
const SettingsCardBody = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-slot="settings-card-body"
    className={cn("flex flex-col gap-4 p-4", className)}
    {...props}
  />
);

export {
  SettingsCard,
  SettingsCardBody,
  SettingsPage,
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowText,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionHeader,
  SettingsSectionTitle,
};
