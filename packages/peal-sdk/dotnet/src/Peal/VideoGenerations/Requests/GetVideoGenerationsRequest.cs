using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record GetVideoGenerationsRequest
{
    [JsonIgnore]
    public required string WorkspaceId { get; set; }

    [JsonIgnore]
    public required string GenerationId { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
