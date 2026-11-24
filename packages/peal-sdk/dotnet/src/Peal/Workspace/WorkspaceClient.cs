using Peal.Core;

namespace Peal.Workspace;

public partial class WorkspaceClient : IWorkspaceClient
{
    private readonly RawClient _client;

    internal WorkspaceClient(RawClient client)
    {
        _client = client;
        Security = new SecurityClient(_client);
        Activity = new ActivityClient(_client);
        ApiKeys = new ApiKeysClient(_client);
        Members = new MembersClient(_client);
        Invitations = new InvitationsClient(_client);
        Billing = new BillingClient(_client);
        Usage = new UsageClient(_client);
    }

    public ISecurityClient Security { get; }

    public IActivityClient Activity { get; }

    public IApiKeysClient ApiKeys { get; }

    public IMembersClient Members { get; }

    public IInvitationsClient Invitations { get; }

    public IBillingClient Billing { get; }

    public IUsageClient Usage { get; }
}
