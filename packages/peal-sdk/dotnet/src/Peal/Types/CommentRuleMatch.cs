using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record CommentRuleMatch : IJsonOnDeserialized
{
    [JsonExtensionData]
    private readonly IDictionary<string, JsonElement> _extensionData =
        new Dictionary<string, JsonElement>();

    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("commentId")]
    public required string CommentId { get; set; }

    [JsonPropertyName("lookedAt")]
    public required string LookedAt { get; set; }

    [JsonPropertyName("outcome")]
    public required CommentRuleOutcome Outcome { get; set; }

    [JsonPropertyName("privateCode")]
    public string? PrivateCode { get; set; }

    [JsonPropertyName("privateReplyId")]
    public string? PrivateReplyId { get; set; }

    [JsonPropertyName("privateStatus")]
    public CommentRulePrivateStatus? PrivateStatus { get; set; }

    [JsonPropertyName("replyId")]
    public string? ReplyId { get; set; }

    [JsonIgnore]
    public ReadOnlyAdditionalProperties AdditionalProperties { get; private set; } = new();

    void IJsonOnDeserialized.OnDeserialized() =>
        AdditionalProperties.CopyFromExtensionData(_extensionData);

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
