using Peal;

namespace Peal.Automations;

public partial interface ICommentRulesClient
{
    /// <summary>
    /// Lists the workspace's comment rules, oldest first, 50 a page unless `limit` (at most 100) says otherwise, those with `status` alone when given, each with what its channels can carry and the latest 20 comments it matched. A rule's `privateReply`, and each match's `privateCode`, `privateReplyId` and `privateStatus`, are null to a reader who may not read private replies: one without engagement:readMessages, or an application the owner did not let read the workspace's messages. Needs engagement:read.
    /// </summary>
    WithRawResponseTask<CommentRulePage> ListAsync(
        ListCommentRulesRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Starts a rule on the comments of a post that went out (`postId`) or of every post of a channel (`channelId`), exactly one of them, with 1 to 10 `keywords`, a `reply` and, optionally, a `privateReply`. A rule answers, by itself and in public, as the channel's account, a comment written after it started or was last set going again, under a post it answers on (a post's rule acts on the channels the post is for, scheduled or out), that holds one of its keywords as a word (whatever its case and accents): with its `reply`, once a comment and once a person, 25 replies a day at most, and 100 a day for every rule of a channel together, through the inbox's own replies (their journal, one reply a comment, each one of the billing account's outbound messages). It answers on Mastodon, and on Facebook Pages and Instagram where the server reads their comments; Bluesky's, X's, LinkedIn's and YouTube's rules forbid an app to answer by itself, and `channels` says so. It never likes or follows anyone. With a `privateReply`, it also sends the author of each comment it answered that one private message, once its public reply is out: only on Instagram and Facebook Pages, whose platforms let an account send a commenter one message within 7 days of the comment, only where the channel's messages are on (a channel that cannot carry it answers in public only, and the match's `privateCode` says why), never twice to a comment, whoever sent the first, and never to anyone who did not comment. It acts as whoever started it, with what they may do then: it ends when they can no longer answer comments, and when its channel is disconnected. It is refused when no channel it answers on can carry its reply, or its private reply when it has one (CommentRuleNotPossible, with each channel's reason). A workspace keeps 100 rules active or paused. Needs engagement:reply, and engagement:message with a private reply (an application, the owner's consent for messages too); never staff acting as a member.
    /// </summary>
    WithRawResponseTask<CommentRule> CreateAsync(
        NewCommentRule request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Answers a comment rule of the workspace, what its channels can carry and what it matched. A rule's `privateReply`, and each match's `privateCode`, `privateReplyId` and `privateStatus`, are null to a reader who may not read private replies: one without engagement:readMessages, or an application the owner did not let read the workspace's messages. Needs engagement:read.
    /// </summary>
    WithRawResponseTask<CommentRule> GetAsync(
        GetCommentRulesRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Stops a rule: it answers nothing more; the replies it sent stay, and the inbox withdraws one as any other. Needs engagement:reply.
    /// </summary>
    WithRawResponseTask DeleteAsync(
        DeleteCommentRulesRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Changes a rule's keywords, reply or private reply (`privateReply` null takes it off), or pauses it (`paused` true) or sets it going again (false); what it leaves out stays. A paused rule looks at nothing, answers no comment received while it was paused, and sends none of the private replies that waited for their public reply. An ended rule changes no more (CommentRuleEnded). Needs engagement:reply, and engagement:message to give a private reply, or to change the keywords or the reply of a rule that holds one or set it going again (an application, the owner's consent for messages too); pausing a rule, or taking its private reply off, needs engagement:reply alone.
    /// </summary>
    WithRawResponseTask<CommentRule> UpdateAsync(
        CommentRuleChange request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );
}
