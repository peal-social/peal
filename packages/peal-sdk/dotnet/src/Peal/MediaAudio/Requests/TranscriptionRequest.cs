using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record TranscriptionRequest
{
    [JsonIgnore]
    public required string WorkspaceId { get; set; }

    [JsonIgnore]
    public required string MediaId { get; set; }

    [JsonPropertyName("saveAsDescription")]
    public bool? SaveAsDescription { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
