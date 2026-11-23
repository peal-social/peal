using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record NoticeEventVideoGenerationEnded : IJsonOnDeserialized
{
    [JsonExtensionData]
    private readonly IDictionary<string, JsonElement> _extensionData =
        new Dictionary<string, JsonElement>();

    [JsonPropertyName("generationId")]
    public required string GenerationId { get; set; }

    [JsonPropertyName("mediaId")]
    public string? MediaId { get; set; }

    [JsonPropertyName("outcome")]
    public required NoticeEventVideoGenerationEndedOutcome Outcome { get; set; }

    [JsonPropertyName("reason")]
    public VideoFailureReason? Reason { get; set; }

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
