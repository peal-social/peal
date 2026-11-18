using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record BrowserAnalytics : IJsonOnDeserialized
{
    [JsonExtensionData]
    private readonly IDictionary<string, JsonElement> _extensionData =
        new Dictionary<string, JsonElement>();

    [JsonPropertyName("token")]
    public required string Token { get; set; }

    [JsonPropertyName("environment")]
    public required string Environment { get; set; }

    [JsonPropertyName("consent")]
    public required BrowserAnalyticsConsent Consent { get; set; }

    [JsonPropertyName("decidedAt")]
    public string? DecidedAt { get; set; }

    [JsonPropertyName("excludedWorkspaceIds")]
    public IEnumerable<string> ExcludedWorkspaceIds { get; set; } = new List<string>();

    [JsonIgnore]
    public ReadOnlyAdditionalProperties AdditionalProperties { get; private set; } = new();

    void IJsonOnDeserialized.OnDeserialized() =>
        AdditionalProperties.CopyFromExtensionData(_extensionData);

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
