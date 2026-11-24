using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Inbox;

[Serializable]
public record SetAnsweredCommentsRequest
{
    [JsonIgnore]
    public required string CommentId { get; set; }

    [JsonPropertyName("answered")]
    public required bool Answered { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
