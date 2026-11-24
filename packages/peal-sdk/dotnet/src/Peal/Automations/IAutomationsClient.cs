namespace Peal.Automations;

public partial interface IAutomationsClient
{
    public ICommentRulesClient CommentRules { get; }
    public IQueuesClient Queues { get; }
    public IRecyclingClient Recycling { get; }
    public IFollowUpsClient FollowUps { get; }
    public IFeedsClient Feeds { get; }
}
