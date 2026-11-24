using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record SetMessageApplicationInboxMessagesRequest
{
    [JsonPropertyName("allowed")]
    public required bool Allowed { get; set; }

    [JsonPropertyName("clientId")]
    public required string ClientId { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
