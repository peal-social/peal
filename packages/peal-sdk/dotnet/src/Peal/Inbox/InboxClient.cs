using Peal.Core;

namespace Peal.Inbox;

public partial class InboxClient : IInboxClient
{
    private readonly RawClient _client;

    internal InboxClient(RawClient client)
    {
        _client = client;
        Comments = new CommentsClient(_client);
        Messages = new MessagesClient(_client);
        Reviews = new ReviewsClient(_client);
    }

    public ICommentsClient Comments { get; }

    public IMessagesClient Messages { get; }

    public IReviewsClient Reviews { get; }
}
