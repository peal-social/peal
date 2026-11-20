import { NotificationPreferencesForm } from "#components/notices/notification-preferences-form.tsx";
import { workspacePageTitle } from "#shell/page-title.ts";

// Which notifications the signed-in person also receives by email, in
// every workspace's settings (the settings' layout checks the membership):
// they are the person's own, whichever workspace shows them.
const NotificationSettingsPage = () => (
  <div className="flex max-w-xl flex-col gap-8">
    <NotificationPreferencesForm />
  </div>
);

export const generateMetadata = workspacePageTitle("notificationSettings");

export default NotificationSettingsPage;
