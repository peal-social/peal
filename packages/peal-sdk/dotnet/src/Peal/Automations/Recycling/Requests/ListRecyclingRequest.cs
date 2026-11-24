using global::System.Text.Json.Serialization;
using Peal;
using Peal.Core;

namespace Peal.Automations;

[Serializable]
public record ListRecyclingRequest
{
    [JsonIgnore]
    public string? Cursor { get; set; }

    [JsonIgnore]
    public string? Limit { get; set; }

    [JsonIgnore]
    public RecyclingStatus? Status { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
