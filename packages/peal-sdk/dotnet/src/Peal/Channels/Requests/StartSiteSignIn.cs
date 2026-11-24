using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record StartSiteSignIn
{
    [JsonIgnore]
    public required OAuthSitePlatform Platform { get; set; }

    [JsonPropertyName("channelId")]
    public string? ChannelId { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
