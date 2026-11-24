using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Automations;

[Serializable]
public record DeleteFollowUpsRequest
{
    [JsonIgnore]
    public required string RuleId { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
