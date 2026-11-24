using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Inbox;

[Serializable]
public record ConfirmMessagesRequest
{
    [JsonIgnore]
    public required string MessageId { get; set; }

    [JsonPropertyName("sent")]
    public required bool Sent { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
