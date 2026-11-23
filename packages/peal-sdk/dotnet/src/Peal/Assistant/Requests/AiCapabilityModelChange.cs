using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record AiCapabilityModelChange
{
    [JsonIgnore]
    public required string WorkspaceId { get; set; }

    [JsonIgnore]
    public required AiCapability Capability { get; set; }

    [JsonPropertyName("model")]
    public string? Model { get; set; }

    [JsonPropertyName("provider")]
    public required AiProvider Provider { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
