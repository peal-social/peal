using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Inbox;

[Serializable]
public record ListThreadsReviewsRequest
{
    [JsonIgnore]
    public string? ChannelId { get; set; }

    [JsonIgnore]
    public string? Cursor { get; set; }

    [JsonIgnore]
    public string? Limit { get; set; }

    [JsonIgnore]
    public ListThreadsReviewsRequestUnanswered? Unanswered { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
