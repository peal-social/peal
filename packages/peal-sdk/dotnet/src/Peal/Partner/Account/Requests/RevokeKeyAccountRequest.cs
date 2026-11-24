using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Partner_;

[Serializable]
public record RevokeKeyAccountRequest
{
    [JsonIgnore]
    public required string PartnerKeyId { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
