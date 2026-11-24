using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Inbox;

[Serializable]
public record SetConversationReadMessagesRequest
{
    [JsonIgnore]
    public required string ConversationId { get; set; }

    [JsonPropertyName("read")]
    public required bool Read { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
