using Peal.Me__;

namespace Peal;

public partial interface IMeClient
{
    public INoticesClient Notices { get; }
    public INotificationPreferencesClient NotificationPreferences { get; }

    /// <summary>
    /// Answers with the signed-in user and every workspace they belong to, with their role and permissions in each, whether the account has two-step verification on and a password, and whether each workspace requires it (a workspace that requires it refuses the user while it is off). Where the server measures the web app's use, it also says how, with the person's choice about it. API keys belong to a workspace, not a user, and get 403.
    /// </summary>
    WithRawResponseTask<Me_> GetAsync(
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );
}
