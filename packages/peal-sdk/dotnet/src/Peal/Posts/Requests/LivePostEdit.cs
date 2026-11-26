using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record LivePostEdit
{
    [JsonIgnore]
    public required string PostId { get; set; }

    [JsonIgnore]
    public required string TargetId { get; set; }

    [JsonIgnore]
    public string? Wait { get; set; }

    [JsonPropertyName("body")]
    public RichText? Body { get; set; }

    [JsonPropertyName("bodyMarkdown")]
    public string? BodyMarkdown { get; set; }

    [JsonPropertyName("options")]
    public TargetOptions? Options { get; set; }

    [JsonPropertyName("part")]
    public int? Part { get; set; }

    [JsonPropertyName("text")]
    public string? Text { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
