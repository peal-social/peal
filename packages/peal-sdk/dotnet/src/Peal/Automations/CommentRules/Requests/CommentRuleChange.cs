using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Automations;

[Serializable]
public record CommentRuleChange
{
    [JsonIgnore]
    public required string RuleId { get; set; }

    [JsonPropertyName("keywords")]
    public IEnumerable<string>? Keywords { get; set; }

    [JsonPropertyName("paused")]
    public bool? Paused { get; set; }

    [JsonPropertyName("privateReply")]
    public string? PrivateReply { get; set; }

    [JsonPropertyName("reply")]
    public string? Reply { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
