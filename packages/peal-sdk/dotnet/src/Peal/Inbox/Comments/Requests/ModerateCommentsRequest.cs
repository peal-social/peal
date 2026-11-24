using global::System.Text.Json.Serialization;
using Peal;
using Peal.Core;

namespace Peal.Inbox;

[Serializable]
public record ModerateCommentsRequest
{
    [JsonIgnore]
    public required string CommentId { get; set; }

    [JsonPropertyName("action")]
    public required InboxModerationAction Action { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
