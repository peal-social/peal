// ReSharper disable NullableWarningSuppressionIsUsed
// ReSharper disable InconsistentNaming

using global::System.Text.Json;
using global::System.Text.Json.Nodes;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(UnprocessableEntityErrorBody.JsonConverter))]
[Serializable]
public record UnprocessableEntityErrorBody
{
    internal UnprocessableEntityErrorBody(string type, object? value)
    {
        Type = type;
        Value = value;
    }

    /// <summary>
    /// Create an instance of UnprocessableEntityErrorBody with <see cref="UnprocessableEntityErrorBody.AiCapabilityNotOffered"/>.
    /// </summary>
    public UnprocessableEntityErrorBody(UnprocessableEntityErrorBody.AiCapabilityNotOffered value)
    {
        Type = "AiCapabilityNotOffered";
        Value = value.Value;
    }

    /// <summary>
    /// Create an instance of UnprocessableEntityErrorBody with <see cref="UnprocessableEntityErrorBody.AiModelRequired"/>.
    /// </summary>
    public UnprocessableEntityErrorBody(UnprocessableEntityErrorBody.AiModelRequired value)
    {
        Type = "AiModelRequired";
        Value = value.Value;
    }

    /// <summary>
    /// Discriminant value
    /// </summary>
    [JsonPropertyName("_tag")]
    public string Type { get; internal set; }

    /// <summary>
    /// Discriminated union value
    /// </summary>
    public object? Value { get; internal set; }

    /// <summary>
    /// Returns true if <see cref="Type"/> is "AiCapabilityNotOffered"
    /// </summary>
    public bool IsAiCapabilityNotOffered => Type == "AiCapabilityNotOffered";

    /// <summary>
    /// Returns true if <see cref="Type"/> is "AiModelRequired"
    /// </summary>
    public bool IsAiModelRequired => Type == "AiModelRequired";

    /// <summary>
    /// Returns the value as a <see cref="Peal.AiCapabilityNotOfferedEncoded"/> if <see cref="Type"/> is 'AiCapabilityNotOffered', otherwise throws an exception.
    /// </summary>
    /// <exception cref="Exception">Thrown when <see cref="Type"/> is not 'AiCapabilityNotOffered'.</exception>
    public Peal.AiCapabilityNotOfferedEncoded AsAiCapabilityNotOffered() =>
        IsAiCapabilityNotOffered
            ? (Peal.AiCapabilityNotOfferedEncoded)Value!
            : throw new global::System.Exception(
                "UnprocessableEntityErrorBody.Type is not 'AiCapabilityNotOffered'"
            );

    /// <summary>
    /// Returns the value as a <see cref="Peal.AiModelRequiredEncoded"/> if <see cref="Type"/> is 'AiModelRequired', otherwise throws an exception.
    /// </summary>
    /// <exception cref="Exception">Thrown when <see cref="Type"/> is not 'AiModelRequired'.</exception>
    public Peal.AiModelRequiredEncoded AsAiModelRequired() =>
        IsAiModelRequired
            ? (Peal.AiModelRequiredEncoded)Value!
            : throw new global::System.Exception(
                "UnprocessableEntityErrorBody.Type is not 'AiModelRequired'"
            );

    public T Match<T>(
        Func<Peal.AiCapabilityNotOfferedEncoded, T> onAiCapabilityNotOffered,
        Func<Peal.AiModelRequiredEncoded, T> onAiModelRequired,
        Func<string, object?, T> onUnknown_
    )
    {
        return Type switch
        {
            "AiCapabilityNotOffered" => onAiCapabilityNotOffered(AsAiCapabilityNotOffered()),
            "AiModelRequired" => onAiModelRequired(AsAiModelRequired()),
            _ => onUnknown_(Type, Value),
        };
    }

    public void Visit(
        Action<Peal.AiCapabilityNotOfferedEncoded> onAiCapabilityNotOffered,
        Action<Peal.AiModelRequiredEncoded> onAiModelRequired,
        Action<string, object?> onUnknown_
    )
    {
        switch (Type)
        {
            case "AiCapabilityNotOffered":
                onAiCapabilityNotOffered(AsAiCapabilityNotOffered());
                break;
            case "AiModelRequired":
                onAiModelRequired(AsAiModelRequired());
                break;
            default:
                onUnknown_(Type, Value);
                break;
        }
    }

    /// <summary>
    /// Attempts to cast the value to a <see cref="Peal.AiCapabilityNotOfferedEncoded"/> and returns true if successful.
    /// </summary>
    public bool TryAsAiCapabilityNotOffered(out Peal.AiCapabilityNotOfferedEncoded? value)
    {
        if (Type == "AiCapabilityNotOffered")
        {
            value = (Peal.AiCapabilityNotOfferedEncoded)Value!;
            return true;
        }
        value = null;
        return false;
    }

    /// <summary>
    /// Attempts to cast the value to a <see cref="Peal.AiModelRequiredEncoded"/> and returns true if successful.
    /// </summary>
    public bool TryAsAiModelRequired(out Peal.AiModelRequiredEncoded? value)
    {
        if (Type == "AiModelRequired")
        {
            value = (Peal.AiModelRequiredEncoded)Value!;
            return true;
        }
        value = null;
        return false;
    }

    public override string ToString() => JsonUtils.Serialize(this);

    public static implicit operator UnprocessableEntityErrorBody(
        UnprocessableEntityErrorBody.AiCapabilityNotOffered value
    ) => new(value);

    public static implicit operator UnprocessableEntityErrorBody(
        UnprocessableEntityErrorBody.AiModelRequired value
    ) => new(value);

    [Serializable]
    internal sealed class JsonConverter : JsonConverter<UnprocessableEntityErrorBody>
    {
        public override bool CanConvert(global::System.Type typeToConvert) =>
            typeof(UnprocessableEntityErrorBody).IsAssignableFrom(typeToConvert);

        public override UnprocessableEntityErrorBody Read(
            ref Utf8JsonReader reader,
            global::System.Type typeToConvert,
            JsonSerializerOptions options
        )
        {
            var json = JsonElement.ParseValue(ref reader);
            if (!json.TryGetProperty("_tag", out var discriminatorElement))
            {
                throw new JsonException("Missing discriminator property '_tag'");
            }
            if (discriminatorElement.ValueKind != JsonValueKind.String)
            {
                if (discriminatorElement.ValueKind == JsonValueKind.Null)
                {
                    throw new JsonException("Discriminator property '_tag' is null");
                }

                throw new JsonException(
                    $"Discriminator property '_tag' is not a string, instead is {discriminatorElement.ToString()}"
                );
            }

            var discriminator =
                discriminatorElement.GetString()
                ?? throw new JsonException("Discriminator property '_tag' is null");

            // Strip the discriminant property to prevent it from leaking into AdditionalProperties
            var jsonObject = System.Text.Json.Nodes.JsonObject.Create(json);
            jsonObject?.Remove("_tag");
            var jsonWithoutDiscriminator =
                jsonObject != null ? JsonSerializer.SerializeToElement(jsonObject, options) : json;

            var value = discriminator switch
            {
                "AiCapabilityNotOffered" =>
                    jsonWithoutDiscriminator.Deserialize<Peal.AiCapabilityNotOfferedEncoded?>(
                        options
                    )
                        ?? throw new JsonException(
                            "Failed to deserialize Peal.AiCapabilityNotOfferedEncoded"
                        ),
                "AiModelRequired" =>
                    jsonWithoutDiscriminator.Deserialize<Peal.AiModelRequiredEncoded?>(options)
                        ?? throw new JsonException(
                            "Failed to deserialize Peal.AiModelRequiredEncoded"
                        ),
                _ => json.Deserialize<object?>(options),
            };
            return new UnprocessableEntityErrorBody(discriminator, value);
        }

        public override void Write(
            Utf8JsonWriter writer,
            UnprocessableEntityErrorBody value,
            JsonSerializerOptions options
        )
        {
            JsonNode json =
                value.Type switch
                {
                    "AiCapabilityNotOffered" => JsonSerializer.SerializeToNode(
                        value.Value,
                        options
                    ),
                    "AiModelRequired" => JsonSerializer.SerializeToNode(value.Value, options),
                    _ => JsonSerializer.SerializeToNode(value.Value, options),
                } ?? new JsonObject();
            json["_tag"] = value.Type;
            json.WriteTo(writer, options);
        }

        public override UnprocessableEntityErrorBody ReadAsPropertyName(
            ref Utf8JsonReader reader,
            global::System.Type typeToConvert,
            JsonSerializerOptions options
        )
        {
            var stringValue =
                reader.GetString()
                ?? throw new JsonException("The JSON property name could not be read as a string.");
            return new UnprocessableEntityErrorBody(stringValue, stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            UnprocessableEntityErrorBody value,
            JsonSerializerOptions options
        )
        {
            writer.WritePropertyName(value.Type);
        }
    }

    /// <summary>
    /// Discriminated union type for AiCapabilityNotOffered
    /// </summary>
    [Serializable]
    public struct AiCapabilityNotOffered
    {
        public AiCapabilityNotOffered(Peal.AiCapabilityNotOfferedEncoded value)
        {
            Value = value;
        }

        internal Peal.AiCapabilityNotOfferedEncoded Value { get; set; }

        public override string ToString() => Value.ToString() ?? "null";

        public static implicit operator UnprocessableEntityErrorBody.AiCapabilityNotOffered(
            Peal.AiCapabilityNotOfferedEncoded value
        ) => new(value);
    }

    /// <summary>
    /// Discriminated union type for AiModelRequired
    /// </summary>
    [Serializable]
    public struct AiModelRequired
    {
        public AiModelRequired(Peal.AiModelRequiredEncoded value)
        {
            Value = value;
        }

        internal Peal.AiModelRequiredEncoded Value { get; set; }

        public override string ToString() => Value.ToString() ?? "null";

        public static implicit operator UnprocessableEntityErrorBody.AiModelRequired(
            Peal.AiModelRequiredEncoded value
        ) => new(value);
    }
}
