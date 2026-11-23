using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record EditRenderRequest
{
    [JsonIgnore]
    public required string WorkspaceId { get; set; }

    [JsonPropertyName("edit")]
    public Dictionary<string, object?> Edit { get; set; } = new Dictionary<string, object?>();

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
