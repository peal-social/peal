using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record VoiceoverRequest
{
    [JsonIgnore]
    public required string WorkspaceId { get; set; }

    [JsonPropertyName("text")]
    public required string Text { get; set; }

    [JsonPropertyName("voice")]
    public string? Voice { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
