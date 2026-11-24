using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record NewCommentRule
{
    [JsonPropertyName("channelId")]
    public string? ChannelId { get; set; }

    [JsonPropertyName("keywords")]
    public IEnumerable<string> Keywords { get; set; } = new List<string>();

    [JsonPropertyName("postId")]
    public string? PostId { get; set; }

    [JsonPropertyName("privateReply")]
    public string? PrivateReply { get; set; }

    [JsonPropertyName("reply")]
    public required string Reply { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
