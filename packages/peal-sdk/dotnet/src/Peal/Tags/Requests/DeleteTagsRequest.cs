using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record DeleteTagsRequest
{
    [JsonIgnore]
    public required string TagId { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
