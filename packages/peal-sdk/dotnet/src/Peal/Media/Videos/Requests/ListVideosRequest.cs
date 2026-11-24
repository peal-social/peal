using global::System.Text.Json.Serialization;
using Peal;
using Peal.Core;

namespace Peal.Media_;

[Serializable]
public record ListVideosRequest
{
    [JsonIgnore]
    public VideoGenerationStatus? Status { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
