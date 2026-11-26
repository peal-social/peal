using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record PostExternalIdChange
{
    [JsonIgnore]
    public required string PostId { get; set; }

    [JsonPropertyName("externalId")]
    public string? ExternalId { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
