using Peal.Automations;
using Peal.Core;
using Peal.Inbox;
using Peal.Workspace;

namespace Peal;

public partial class PealClient : IPealClient
{
    private readonly RawClient _client;

    public PealClient(string token, string? workspace = null, ClientOptions? clientOptions = null)
    {
        clientOptions ??= new ClientOptions();
        var platformHeaders = new Headers(
            new Dictionary<string, string>()
            {
                { "X-Fern-Language", "C#" },
                { "X-Fern-SDK-Name", "Peal" },
                { "X-Fern-SDK-Version", global::Peal.Version.Current },
            }
        );
        if (clientOptions.PealVersion != null)
        {
            platformHeaders["Peal-Version"] = clientOptions.PealVersion;
        }
        foreach (var header in platformHeaders)
        {
            if (!clientOptions.Headers.ContainsKey(header.Key))
            {
                clientOptions.Headers[header.Key] = header.Value;
            }
        }
        var clientOptionsWithAuth = clientOptions.Clone();
        var authHeaders = new Headers(
            new Dictionary<string, string>()
            {
                { "Authorization", $"Bearer {token}" },
                { "Peal-Version", "2026-11-09" },
            }
        );
        foreach (var header in authHeaders)
        {
            clientOptionsWithAuth.Headers[header.Key] = header.Value;
        }
        if (workspace is not null)
        {
            clientOptionsWithAuth.Headers["Peal-Workspace"] = workspace;
        }
        _client = new RawClient(clientOptionsWithAuth);
        Posts = new PostsClient(_client);
        Approvals = new ApprovalsClient(_client);
        Channels = new ChannelsClient(_client);
        Media = new MediaClient(_client);
        Analytics = new AnalyticsClient(_client);
        Ads = new AdsClient(_client);
        Articles = new ArticlesClient(_client);
        Links = new LinksClient(_client);
        Webhooks = new WebhooksClient(_client);
        Assistant = new AssistantClient(_client);
        Partner = new PartnerClient(_client);
        Credential = new CredentialClient(_client);
        System = new SystemClient(_client);
        Automations = new AutomationsClient(_client);
        Inbox = new InboxClient(_client);
        Workspace = new WorkspaceClient(_client);
    }

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

    public ICredentialClient Credential { get; }

    public ISystemClient System { get; }

    public IAutomationsClient Automations { get; }

    public IInboxClient Inbox { get; }

    public IWorkspaceClient Workspace { get; }
}
