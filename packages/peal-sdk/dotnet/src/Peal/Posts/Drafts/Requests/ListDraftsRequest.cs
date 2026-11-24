using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Posts;

[Serializable]
public record ListDraftsRequest
{
    [JsonIgnore]
    public string? Cursor { get; set; }

    [JsonIgnore]
    public string? Limit { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
