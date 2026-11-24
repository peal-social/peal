using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record FindChannelsRequest
{
    [JsonIgnore]
    public string? Cursor { get; set; }

    [JsonIgnore]
    public string? Limit { get; set; }

    [JsonIgnore]
    public Platform? Platform { get; set; }

    [JsonIgnore]
    public string? Q { get; set; }

    [JsonIgnore]
    public ChannelStatusName? Status { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
