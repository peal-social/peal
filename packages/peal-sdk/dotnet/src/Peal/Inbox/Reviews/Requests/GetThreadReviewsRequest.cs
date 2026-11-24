using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Inbox;

[Serializable]
public record GetThreadReviewsRequest
{
    [JsonIgnore]
    public required string ThreadId { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
