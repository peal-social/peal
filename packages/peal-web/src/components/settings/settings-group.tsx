import {
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionHeader,
  SettingsSectionTitle,
} from "peal-ui/components/settings";
import { useId } from "react";
import type { ReactNode } from "react";

/**
 * A section of a settings page (DESIGN.md, "Settings"): its heading, a
 * muted line when it helps, what acts on the whole section at the
 * heading's end, then its card. Without a title the card stands alone, as
 * the page's first section does.
 */
export const SettingsGroup = ({
  actions = null,
  children,
  description = null,
  title = null,
}: {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly description?: ReactNode;
  readonly title?: string | null;
}) => {
  const id = useId();

  return title === null ? (
    <SettingsSection>{children}</SettingsSection>
  ) : (
    <SettingsSection aria-labelledby={id}>
      <SettingsSectionHeader>
        <div className="min-w-0 flex-1">
          <SettingsSectionTitle id={id}>{title}</SettingsSectionTitle>
          {description === null ? null : (
            <SettingsSectionDescription>
              {description}
            </SettingsSectionDescription>
          )}
        </div>
        {actions}
      </SettingsSectionHeader>
      {children}
    </SettingsSection>
  );
};
