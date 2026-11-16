// ReSharper disable NullableWarningSuppressionIsUsed
// ReSharper disable InconsistentNaming

using global::System.Text.Json;
using global::System.Text.Json.Nodes;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(ConnectChat.JsonConverter))]
[Serializable]
public record ConnectChat
{
    internal ConnectChat(string type, object? value)
    {
        Platform = type;
        Value = value;
    }

    /// <summary>
    /// Create an instance of ConnectChat with <see cref="ConnectChat.Discord"/>.
    /// </summary>
    public ConnectChat(ConnectChat.Discord value)
    {
        Platform = "discord";
        Value = value.Value;
    }

    /// <summary>
    /// Create an instance of ConnectChat with <see cref="ConnectChat.Telegram"/>.
    /// </summary>
    public ConnectChat(ConnectChat.Telegram value)
    {
        Platform = "telegram";
        Value = value.Value;
    }

    /// <summary>
    /// Discriminant value
    /// </summary>
    [JsonPropertyName("platform")]
    public string Platform { get; internal set; }

    /// <summary>
    /// Discriminated union value
    /// </summary>
    public object? Value { get; internal set; }

    /// <summary>
    /// Returns true if <see cref="Platform"/> is "discord"
    /// </summary>
    public bool IsDiscord => Platform == "discord";

    /// <summary>
    /// Returns true if <see cref="Platform"/> is "telegram"
    /// </summary>
    public bool IsTelegram => Platform == "telegram";

    /// <summary>
    /// Returns the value as a <see cref="Peal.ConnectDiscordChat"/> if <see cref="Platform"/> is 'discord', otherwise throws an exception.
    /// </summary>
    /// <exception cref="Exception">Thrown when <see cref="Platform"/> is not 'discord'.</exception>
    public Peal.ConnectDiscordChat AsDiscord() =>
        IsDiscord
            ? (Peal.ConnectDiscordChat)Value!
            : throw new global::System.Exception("ConnectChat.Platform is not 'discord'");

    /// <summary>
    /// Returns the value as a <see cref="Peal.ConnectTelegramChat"/> if <see cref="Platform"/> is 'telegram', otherwise throws an exception.
    /// </summary>
    /// <exception cref="Exception">Thrown when <see cref="Platform"/> is not 'telegram'.</exception>
    public Peal.ConnectTelegramChat AsTelegram() =>
        IsTelegram
            ? (Peal.ConnectTelegramChat)Value!
            : throw new global::System.Exception("ConnectChat.Platform is not 'telegram'");

    public T Match<T>(
        Func<Peal.ConnectDiscordChat, T> onDiscord,
        Func<Peal.ConnectTelegramChat, T> onTelegram,
        Func<string, object?, T> onUnknown_
    )
    {
        return Platform switch
        {
            "discord" => onDiscord(AsDiscord()),
            "telegram" => onTelegram(AsTelegram()),
            _ => onUnknown_(Platform, Value),
        };
    }

    public void Visit(
        Action<Peal.ConnectDiscordChat> onDiscord,
        Action<Peal.ConnectTelegramChat> onTelegram,
        Action<string, object?> onUnknown_
    )
    {
        switch (Platform)
        {
            case "discord":
                onDiscord(AsDiscord());
                break;
            case "telegram":
                onTelegram(AsTelegram());
                break;
            default:
                onUnknown_(Platform, Value);
                break;
        }
    }

    /// <summary>
    /// Attempts to cast the value to a <see cref="Peal.ConnectDiscordChat"/> and returns true if successful.
    /// </summary>
    public bool TryAsDiscord(out Peal.ConnectDiscordChat? value)
    {
        if (Platform == "discord")
        {
            value = (Peal.ConnectDiscordChat)Value!;
            return true;
        }
        value = null;
        return false;
    }

    /// <summary>
    /// Attempts to cast the value to a <see cref="Peal.ConnectTelegramChat"/> and returns true if successful.
    /// </summary>
    public bool TryAsTelegram(out Peal.ConnectTelegramChat? value)
    {
        if (Platform == "telegram")
        {
            value = (Peal.ConnectTelegramChat)Value!;
            return true;
        }
        value = null;
        return false;
    }

    public override string ToString() => JsonUtils.Serialize(this);

    public static implicit operator ConnectChat(ConnectChat.Discord value) => new(value);

    public static implicit operator ConnectChat(ConnectChat.Telegram value) => new(value);

    [Serializable]
    internal sealed class JsonConverter : JsonConverter<ConnectChat>
    {
        public override bool CanConvert(global::System.Type typeToConvert) =>
            typeof(ConnectChat).IsAssignableFrom(typeToConvert);

        public override ConnectChat Read(
            ref Utf8JsonReader reader,
            global::System.Type typeToConvert,
            JsonSerializerOptions options
        )
        {
            var json = JsonElement.ParseValue(ref reader);
            if (!json.TryGetProperty("platform", out var discriminatorElement))
            {
                throw new JsonException("Missing discriminator property 'platform'");
            }
            if (discriminatorElement.ValueKind != JsonValueKind.String)
            {
                if (discriminatorElement.ValueKind == JsonValueKind.Null)
                {
                    throw new JsonException("Discriminator property 'platform' is null");
                }

                throw new JsonException(
                    $"Discriminator property 'platform' is not a string, instead is {discriminatorElement.ToString()}"
                );
            }

            var discriminator =
                discriminatorElement.GetString()
                ?? throw new JsonException("Discriminator property 'platform' is null");

            // Strip the discriminant property to prevent it from leaking into AdditionalProperties
            var jsonObject = System.Text.Json.Nodes.JsonObject.Create(json);
            jsonObject?.Remove("platform");
            var jsonWithoutDiscriminator =
                jsonObject != null ? JsonSerializer.SerializeToElement(jsonObject, options) : json;

            var value = discriminator switch
            {
                "discord" => jsonWithoutDiscriminator.Deserialize<Peal.ConnectDiscordChat?>(options)
                    ?? throw new JsonException("Failed to deserialize Peal.ConnectDiscordChat"),
                "telegram" => jsonWithoutDiscriminator.Deserialize<Peal.ConnectTelegramChat?>(
                    options
                ) ?? throw new JsonException("Failed to deserialize Peal.ConnectTelegramChat"),
                _ => json.Deserialize<object?>(options),
            };
            return new ConnectChat(discriminator, value);
        }

        public override void Write(
            Utf8JsonWriter writer,
            ConnectChat value,
            JsonSerializerOptions options
        )
        {
            JsonNode json =
                value.Platform switch
                {
                    "discord" => JsonSerializer.SerializeToNode(value.Value, options),
                    "telegram" => JsonSerializer.SerializeToNode(value.Value, options),
                    _ => JsonSerializer.SerializeToNode(value.Value, options),
                } ?? new JsonObject();
            json["platform"] = value.Platform;
            json.WriteTo(writer, options);
        }

        public override ConnectChat ReadAsPropertyName(
            ref Utf8JsonReader reader,
            global::System.Type typeToConvert,
            JsonSerializerOptions options
        )
        {
            var stringValue =
                reader.GetString()
                ?? throw new JsonException("The JSON property name could not be read as a string.");
            return new ConnectChat(stringValue, stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            ConnectChat value,
            JsonSerializerOptions options
        )
        {
            writer.WritePropertyName(value.Platform);
        }
    }

    /// <summary>
    /// Discriminated union type for discord
    /// </summary>
    [Serializable]
    public struct Discord
    {
        public Discord(Peal.ConnectDiscordChat value)
        {
            Value = value;
        }

        internal Peal.ConnectDiscordChat Value { get; set; }

        public override string ToString() => Value.ToString() ?? "null";

        public static implicit operator ConnectChat.Discord(Peal.ConnectDiscordChat value) =>
            new(value);
    }

    /// <summary>
    /// Discriminated union type for telegram
    /// </summary>
    [Serializable]
    public struct Telegram
    {
        public Telegram(Peal.ConnectTelegramChat value)
        {
            Value = value;
        }

        internal Peal.ConnectTelegramChat Value { get; set; }

        public override string ToString() => Value.ToString() ?? "null";

        public static implicit operator ConnectChat.Telegram(Peal.ConnectTelegramChat value) =>
            new(value);
    }
}
