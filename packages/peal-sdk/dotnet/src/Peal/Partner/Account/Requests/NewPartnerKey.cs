using global::System.Text.Json.Serialization;
using Peal;
using Peal.Core;

namespace Peal.Partner_;

[Serializable]
public record NewPartnerKey
{
    [JsonPropertyName("expiresInDays")]
    public int? ExpiresInDays { get; set; }

    [JsonPropertyName("name")]
    public required string Name { get; set; }

    [JsonPropertyName("permissions")]
    public IEnumerable<Permission> Permissions { get; set; } = new List<Permission>();

    [JsonPropertyName("scopes")]
    public IEnumerable<PartnerScope> Scopes { get; set; } = new List<PartnerScope>();

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
