using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Channels;

[Serializable]
public record GetTiktokCreatorRequest
{
    [JsonIgnore]
    public required string ChannelId { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
