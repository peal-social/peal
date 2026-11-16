using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

/// <summary>
/// How a post goes out on a Discord channel, on every part of a thread. Scheduling needs none of them; a forum channel needs a thread name.
/// </summary>
[Serializable]
public record DiscordOptions : IJsonOnDeserialized
{
    [JsonExtensionData]
    private readonly IDictionary<string, JsonElement> _extensionData =
        new Dictionary<string, JsonElement>();

    [JsonPropertyName("mentions")]
    public bool? Mentions { get; set; }

    [JsonPropertyName("silent")]
    public bool? Silent { get; set; }

    [JsonPropertyName("suppressEmbeds")]
    public bool? SuppressEmbeds { get; set; }

    [JsonPropertyName("threadName")]
    public string? ThreadName { get; set; }

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
