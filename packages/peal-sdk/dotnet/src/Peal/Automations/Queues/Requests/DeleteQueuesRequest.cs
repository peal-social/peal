using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Automations;

[Serializable]
public record DeleteQueuesRequest
{
    [JsonIgnore]
    public required string QueueId { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
