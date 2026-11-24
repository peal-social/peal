using global::System.Text.Json.Serialization;
using Peal;
using Peal.Core;

namespace Peal.Media_;

[Serializable]
public record ImageRequest
{
    [JsonPropertyName("aspect")]
    public required ImageAspect Aspect { get; set; }

    [JsonPropertyName("prompt")]
    public required string Prompt { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
