using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record AiProviderTest
{
    [JsonIgnore]
    public required AiProvider Provider { get; set; }

    [JsonPropertyName("model")]
    public string? Model { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
