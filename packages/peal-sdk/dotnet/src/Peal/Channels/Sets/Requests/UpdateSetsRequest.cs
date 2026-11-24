using global::System.Text.Json.Serialization;
using Peal;
using Peal.Core;

namespace Peal.Channels;

[Serializable]
public record UpdateSetsRequest
{
    [JsonIgnore]
    public required string ChannelSetId { get; set; }

    [JsonIgnore]
    public required ChannelSetDetails Body { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
