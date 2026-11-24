using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Partner_;

[Serializable]
public record GetCustomerUsageRequest
{
    [JsonIgnore]
    public string? Before { get; set; }

    [JsonIgnore]
    public string? From { get; set; }

    [JsonIgnore]
    public string? Limit { get; set; }

    [JsonIgnore]
    public string? To { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
