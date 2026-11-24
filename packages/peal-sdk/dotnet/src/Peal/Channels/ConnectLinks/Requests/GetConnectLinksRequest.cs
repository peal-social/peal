using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Channels;

[Serializable]
public record GetConnectLinksRequest
{
    [JsonIgnore]
    public required string LinkId { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
