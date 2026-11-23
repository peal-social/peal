using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using OneOf;
using Peal.Core;

namespace Peal;

[Serializable]
public record Transcript : IJsonOnDeserialized
{
    [JsonExtensionData]
    private readonly IDictionary<string, JsonElement> _extensionData =
        new Dictionary<string, JsonElement>();

    [JsonPropertyName("descriptionSaved")]
    public required bool DescriptionSaved { get; set; }

    [JsonPropertyName("durationSeconds")]
    public OneOf<double, NonFiniteNumber>? DurationSeconds { get; set; }

    [JsonPropertyName("language")]
    public string? Language { get; set; }

    [JsonPropertyName("text")]
    public required string Text { get; set; }

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
