using global::System.Text.Json.Serialization;
using Peal;
using Peal.Core;

namespace Peal.Automations;

[Serializable]
public record ListCommentRulesRequest
{
    [JsonIgnore]
    public string? Cursor { get; set; }

    [JsonIgnore]
    public string? Limit { get; set; }

    [JsonIgnore]
    public CommentRuleStatus? Status { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
