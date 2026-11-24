using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record VideoGenerationRequest
{
    [JsonPropertyName("aspect")]
    public required ImageAspect Aspect { get; set; }

    [JsonPropertyName("durationSeconds")]
    public int? DurationSeconds { get; set; }

    [JsonPropertyName("imageMediaId")]
    public string? ImageMediaId { get; set; }

    [JsonPropertyName("prompt")]
    public required string Prompt { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
