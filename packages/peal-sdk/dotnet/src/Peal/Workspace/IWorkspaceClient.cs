namespace Peal.Workspace;

public partial interface IWorkspaceClient
{
    public ISecurityClient Security { get; }
    public IActivityClient Activity { get; }
    public IApiKeysClient ApiKeys { get; }
    public IMembersClient Members { get; }
    public IInvitationsClient Invitations { get; }
    public IBillingClient Billing { get; }
    public IUsageClient Usage { get; }
}
