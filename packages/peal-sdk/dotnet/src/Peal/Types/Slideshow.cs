using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using OneOf;
using Peal.Core;

namespace Peal;

[Serializable]
public record Slideshow : IJsonOnDeserialized
{
    [JsonExtensionData]
    private readonly IDictionary<string, JsonElement> _extensionData =
        new Dictionary<string, JsonElement>();

    [JsonPropertyName("aspect")]
    public required ImageAspect Aspect { get; set; }

    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; set; }

    [JsonPropertyName("durationSeconds")]
    public required OneOf<double, NonFiniteNumber> DurationSeconds { get; set; }

    [JsonPropertyName("finishedAt")]
    public string? FinishedAt { get; set; }

    [JsonPropertyName("id")]
    public required string Id { get; set; }

    [JsonPropertyName("imageMediaIds")]
    public IEnumerable<string> ImageMediaIds { get; set; } = new List<string>();

    [JsonPropertyName("mediaId")]
    public string? MediaId { get; set; }

    [JsonPropertyName("reason")]
    public SlideshowFailureReason? Reason { get; set; }

    [JsonPropertyName("sandbox")]
    public required bool Sandbox { get; set; }

    [JsonPropertyName("startedAt")]
    public string? StartedAt { get; set; }

    [JsonPropertyName("status")]
    public required SlideshowStatus Status { get; set; }

    [JsonPropertyName("voiceoverMediaId")]
    public string? VoiceoverMediaId { get; set; }

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
