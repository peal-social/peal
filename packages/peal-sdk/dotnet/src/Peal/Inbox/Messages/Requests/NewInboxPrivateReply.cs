using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Inbox;

[Serializable]
public record NewInboxPrivateReply
{
    [JsonIgnore]
    public string? IdempotencyKey { get; set; }

    [JsonPropertyName("commentId")]
    public required string CommentId { get; set; }

    [JsonPropertyName("text")]
    public required string Text { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
