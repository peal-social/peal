using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Media_;

[Serializable]
public record EditRenderRequest
{
    [JsonPropertyName("edit")]
    public Dictionary<string, object?> Edit { get; set; } = new Dictionary<string, object?>();

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
