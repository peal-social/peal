using global::System.Text.Json.Serialization;
using Peal;
using Peal.Core;

namespace Peal.Automations;

[Serializable]
public record UpdateQueuesRequest
{
    [JsonIgnore]
    public required string QueueId { get; set; }

    [JsonIgnore]
    public required QueueDetails Body { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
