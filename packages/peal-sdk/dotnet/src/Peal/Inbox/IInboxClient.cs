namespace Peal.Inbox;

public partial interface IInboxClient
{
    public ICommentsClient Comments { get; }
    public IMessagesClient Messages { get; }
    public IReviewsClient Reviews { get; }
}
