using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record DeleteArticlesRequest
{
    [JsonIgnore]
    public required string ArticleId { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
