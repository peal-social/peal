using Peal.Automations;
using Peal.Inbox;
using Peal.Workspace;

namespace Peal;

public partial interface IPealClient
{
    public IPostsClient Posts { get; }
    public IApprovalsClient Approvals { get; }
    public IChannelsClient Channels { get; }
    public IMediaClient Media { get; }
    public IAnalyticsClient Analytics { get; }
    public IAdsClient Ads { get; }
    public IArticlesClient Articles { get; }
    public ILinksClient Links { get; }
    public IWebhooksClient Webhooks { get; }
    public IAssistantClient Assistant { get; }
    public IPartnerClient Partner { get; }
    public IMeClient Me { get; }
    public ICredentialClient Credential { get; }
    public ISystemClient System { get; }
    public IAutomationsClient Automations { get; }
    public IInboxClient Inbox { get; }
    public IWorkspaceClient Workspace { get; }
}
