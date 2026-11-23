import { NotificationPreferencesForm } from "#components/notices/notification-preferences-form.tsx";
import { workspacePageTitle } from "#shell/page-title.ts";

// Which notifications the signed-in person also receives by email, in
// every workspace's settings (the settings' layout checks the membership):
// they are the person's own, whichever workspace shows them.
const NotificationSettingsPage = () => <NotificationPreferencesForm />;

export const generateMetadata = workspacePageTitle("notificationSettings");

export default NotificationSettingsPage;
