using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record AssistantTranscriptionsStatus : IJsonOnDeserialized
{
    [JsonExtensionData]
    private readonly IDictionary<string, JsonElement> _extensionData =
        new Dictionary<string, JsonElement>();

    [JsonPropertyName("available")]
    public required bool Available { get; set; }

    [JsonPropertyName("dailyLimit")]
    public required int DailyLimit { get; set; }

    [JsonPropertyName("maxBytes")]
    public required int MaxBytes { get; set; }

    [JsonPropertyName("provider")]
    public AiProvider? Provider { get; set; }

    [JsonPropertyName("remaining")]
    public required int Remaining { get; set; }

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
