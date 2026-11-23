using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[Serializable]
public record ApiKeysAtStakeRoles : IJsonOnDeserialized
{
    [JsonExtensionData]
    private readonly IDictionary<string, JsonElement> _extensionData =
        new Dictionary<string, JsonElement>();

    [JsonPropertyName("admin")]
    public required int Admin { get; set; }

    [JsonPropertyName("contributor")]
    public required int Contributor { get; set; }

    [JsonPropertyName("editor")]
    public required int Editor { get; set; }

    [JsonPropertyName("owner")]
    public required int Owner { get; set; }

    [JsonPropertyName("viewer")]
    public required int Viewer { get; set; }

    [JsonIgnore]
    public ReadOnlyAdditionalProperties AdditionalProperties { get; private set; } = new();

    void IJsonOnDeserialized.OnDeserialized() =>
        AdditionalProperties.CopyFromExtensionData(_extensionData);

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
