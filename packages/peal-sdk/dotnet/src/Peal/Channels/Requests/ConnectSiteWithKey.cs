using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record ConnectSiteWithKey
{
    [JsonIgnore]
    public required string WorkspaceId { get; set; }

    [JsonPropertyName("apiKey")]
    public required string ApiKey { get; set; }

    [JsonPropertyName("platform")]
    public required KeySitePlatform Platform { get; set; }

    [JsonPropertyName("publication")]
    public string? Publication { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
