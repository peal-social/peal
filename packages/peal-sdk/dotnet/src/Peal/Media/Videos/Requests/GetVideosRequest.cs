using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Media_;

[Serializable]
public record GetVideosRequest
{
    [JsonIgnore]
    public required string GenerationId { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
