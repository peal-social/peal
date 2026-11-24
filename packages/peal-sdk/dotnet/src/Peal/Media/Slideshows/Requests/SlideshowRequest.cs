using global::System.Text.Json.Serialization;
using Peal;
using Peal.Core;

namespace Peal.Media_;

[Serializable]
public record SlideshowRequest
{
    [JsonPropertyName("aspect")]
    public required ImageAspect Aspect { get; set; }

    [JsonPropertyName("secondsPerSlide")]
    public int? SecondsPerSlide { get; set; }

    [JsonPropertyName("slides")]
    public IEnumerable<Slide> Slides { get; set; } = new List<Slide>();

    [JsonPropertyName("transition")]
    public SlideTransition? Transition { get; set; }

    [JsonPropertyName("voiceoverMediaId")]
    public string? VoiceoverMediaId { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
