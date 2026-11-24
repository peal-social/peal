using global::System.Text.Json.Serialization;
using Peal;
using Peal.Core;

namespace Peal.Channels;

[Serializable]
public record NewConnectLink
{
    [JsonPropertyName("channelId")]
    public string? ChannelId { get; set; }

    [JsonPropertyName("connection")]
    public ChannelConnection? Connection { get; set; }

    [JsonPropertyName("expiresInHours")]
    public int? ExpiresInHours { get; set; }

    [JsonPropertyName("locale")]
    public ConnectLinkLocale? Locale { get; set; }

    [JsonPropertyName("platform")]
    public Platform? Platform { get; set; }

    [JsonPropertyName("platforms")]
    public IEnumerable<Platform>? Platforms { get; set; }

    [JsonPropertyName("returnUrl")]
    public string? ReturnUrl { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
