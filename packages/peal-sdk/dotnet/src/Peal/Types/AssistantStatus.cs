using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record AssistantStatus : IJsonOnDeserialized
{
    [JsonExtensionData]
    private readonly IDictionary<string, JsonElement> _extensionData =
        new Dictionary<string, JsonElement>();

    [JsonPropertyName("available")]
    public required bool Available { get; set; }

    [JsonPropertyName("dailyLimit")]
    public required int DailyLimit { get; set; }

    [JsonPropertyName("images")]
    public required AssistantImagesStatus Images { get; set; }

    [JsonPropertyName("maxTextLength")]
    public required int MaxTextLength { get; set; }

    [JsonPropertyName("month")]
    public AssistantMonth? Month { get; set; }

    [JsonPropertyName("reason")]
    public AssistantOffReason? Reason { get; set; }

    [JsonPropertyName("remaining")]
    public required int Remaining { get; set; }

    [JsonPropertyName("resetsAt")]
    public required string ResetsAt { get; set; }

    [JsonPropertyName("slideshows")]
    public required AssistantSlideshowsStatus Slideshows { get; set; }

    [JsonPropertyName("source")]
    public AssistantTextSource? Source { get; set; }

    [JsonPropertyName("transcriptions")]
    public required AssistantTranscriptionsStatus Transcriptions { get; set; }

    [JsonPropertyName("videos")]
    public required AssistantVideosStatus Videos { get; set; }

    [JsonPropertyName("voiceovers")]
    public required AssistantVoiceoversStatus Voiceovers { get; set; }

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
