using global::System.Text.Json.Serialization;
using Peal;
using Peal.Core;

namespace Peal.Automations;

[Serializable]
public record RecyclingResume
{
    [JsonIgnore]
    public required string RuleId { get; set; }

    [JsonPropertyName("variants")]
    public IEnumerable<RecyclingVariant>? Variants { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
