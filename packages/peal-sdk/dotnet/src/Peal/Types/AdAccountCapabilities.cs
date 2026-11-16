using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

/// <summary>
/// What Peal reads and does on an ad account, as its network allows: a client hides what is false (the ads list, boosting and spending, reach, results).
/// </summary>
[Serializable]
public record AdAccountCapabilities : IJsonOnDeserialized
{
    [JsonExtensionData]
    private readonly IDictionary<string, JsonElement> _extensionData =
        new Dictionary<string, JsonElement>();

    [JsonPropertyName("ads")]
    public required bool Ads { get; set; }

    [JsonPropertyName("boosts")]
    public required bool Boosts { get; set; }

    [JsonPropertyName("reach")]
    public required bool Reach { get; set; }

    [JsonPropertyName("results")]
    public required bool Results { get; set; }

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
