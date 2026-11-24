using Peal.Core;

namespace Peal.Automations;

public partial class AutomationsClient : IAutomationsClient
{
    private readonly RawClient _client;

    internal AutomationsClient(RawClient client)
    {
        _client = client;
        CommentRules = new CommentRulesClient(_client);
        Queues = new QueuesClient(_client);
        Recycling = new RecyclingClient(_client);
        FollowUps = new FollowUpsClient(_client);
        Feeds = new FeedsClient(_client);
    }

    public ICommentRulesClient CommentRules { get; }

    public IQueuesClient Queues { get; }

    public IRecyclingClient Recycling { get; }

    public IFollowUpsClient FollowUps { get; }

    public IFeedsClient Feeds { get; }
}
