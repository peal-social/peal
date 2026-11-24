using global::System.Text.Json.Serialization;
using Peal.Core;
using Peal.Me;

namespace Peal.Me__;

[Serializable]
public record NotificationPreferencesChange
{
    [JsonPropertyName("email")]
    public NotificationPreferencesChangeEmail? Email { get; set; }

    [JsonPropertyName("everyPost")]
    public bool? EveryPost { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
