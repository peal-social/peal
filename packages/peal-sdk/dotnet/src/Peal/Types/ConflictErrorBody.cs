// ReSharper disable NullableWarningSuppressionIsUsed
// ReSharper disable InconsistentNaming

using global::System.Text.Json;
using global::System.Text.Json.Nodes;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(ConflictErrorBody.JsonConverter))]
[Serializable]
public record ConflictErrorBody
{
    internal ConflictErrorBody(string type, object? value)
    {
        Type = type;
        Value = value;
    }

    /// <summary>
    /// Create an instance of ConflictErrorBody with <see cref="ConflictErrorBody.ChannelAccountTaken"/>.
    /// </summary>
    public ConflictErrorBody(ConflictErrorBody.ChannelAccountTaken value)
    {
        Type = "ChannelAccountTaken";
        Value = value.Value;
    }

    /// <summary>
    /// Create an instance of ConflictErrorBody with <see cref="ConflictErrorBody.IdempotencyKeyReused"/>.
    /// </summary>
    public ConflictErrorBody(ConflictErrorBody.IdempotencyKeyReused value)
    {
        Type = "IdempotencyKeyReused";
        Value = value.Value;
    }

    /// <summary>
    /// Create an instance of ConflictErrorBody with <see cref="ConflictErrorBody.WorkspaceBusy"/>.
    /// </summary>
    public ConflictErrorBody(ConflictErrorBody.WorkspaceBusy value)
    {
        Type = "WorkspaceBusy";
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
    /// Returns true if <see cref="Type"/> is "ChannelAccountTaken"
    /// </summary>
    public bool IsChannelAccountTaken => Type == "ChannelAccountTaken";

    /// <summary>
    /// Returns true if <see cref="Type"/> is "IdempotencyKeyReused"
    /// </summary>
    public bool IsIdempotencyKeyReused => Type == "IdempotencyKeyReused";

    /// <summary>
    /// Returns true if <see cref="Type"/> is "WorkspaceBusy"
    /// </summary>
    public bool IsWorkspaceBusy => Type == "WorkspaceBusy";

    /// <summary>
    /// Returns the value as a <see cref="Peal.ChannelAccountTakenEncoded"/> if <see cref="Type"/> is 'ChannelAccountTaken', otherwise throws an exception.
    /// </summary>
    /// <exception cref="Exception">Thrown when <see cref="Type"/> is not 'ChannelAccountTaken'.</exception>
    public Peal.ChannelAccountTakenEncoded AsChannelAccountTaken() =>
        IsChannelAccountTaken
            ? (Peal.ChannelAccountTakenEncoded)Value!
            : throw new global::System.Exception(
                "ConflictErrorBody.Type is not 'ChannelAccountTaken'"
            );

    /// <summary>
    /// Returns the value as a <see cref="Peal.IdempotencyKeyReusedEncoded"/> if <see cref="Type"/> is 'IdempotencyKeyReused', otherwise throws an exception.
    /// </summary>
    /// <exception cref="Exception">Thrown when <see cref="Type"/> is not 'IdempotencyKeyReused'.</exception>
    public Peal.IdempotencyKeyReusedEncoded AsIdempotencyKeyReused() =>
        IsIdempotencyKeyReused
            ? (Peal.IdempotencyKeyReusedEncoded)Value!
            : throw new global::System.Exception(
                "ConflictErrorBody.Type is not 'IdempotencyKeyReused'"
            );

    /// <summary>
    /// Returns the value as a <see cref="Peal.WorkspaceBusyEncoded"/> if <see cref="Type"/> is 'WorkspaceBusy', otherwise throws an exception.
    /// </summary>
    /// <exception cref="Exception">Thrown when <see cref="Type"/> is not 'WorkspaceBusy'.</exception>
    public Peal.WorkspaceBusyEncoded AsWorkspaceBusy() =>
        IsWorkspaceBusy
            ? (Peal.WorkspaceBusyEncoded)Value!
            : throw new global::System.Exception("ConflictErrorBody.Type is not 'WorkspaceBusy'");

    public T Match<T>(
        Func<Peal.ChannelAccountTakenEncoded, T> onChannelAccountTaken,
        Func<Peal.IdempotencyKeyReusedEncoded, T> onIdempotencyKeyReused,
        Func<Peal.WorkspaceBusyEncoded, T> onWorkspaceBusy,
        Func<string, object?, T> onUnknown_
    )
    {
        return Type switch
        {
            "ChannelAccountTaken" => onChannelAccountTaken(AsChannelAccountTaken()),
            "IdempotencyKeyReused" => onIdempotencyKeyReused(AsIdempotencyKeyReused()),
            "WorkspaceBusy" => onWorkspaceBusy(AsWorkspaceBusy()),
            _ => onUnknown_(Type, Value),
        };
    }

    public void Visit(
        Action<Peal.ChannelAccountTakenEncoded> onChannelAccountTaken,
        Action<Peal.IdempotencyKeyReusedEncoded> onIdempotencyKeyReused,
        Action<Peal.WorkspaceBusyEncoded> onWorkspaceBusy,
        Action<string, object?> onUnknown_
    )
    {
        switch (Type)
        {
            case "ChannelAccountTaken":
                onChannelAccountTaken(AsChannelAccountTaken());
                break;
            case "IdempotencyKeyReused":
                onIdempotencyKeyReused(AsIdempotencyKeyReused());
                break;
            case "WorkspaceBusy":
                onWorkspaceBusy(AsWorkspaceBusy());
                break;
            default:
                onUnknown_(Type, Value);
                break;
        }
    }

    /// <summary>
    /// Attempts to cast the value to a <see cref="Peal.ChannelAccountTakenEncoded"/> and returns true if successful.
    /// </summary>
    public bool TryAsChannelAccountTaken(out Peal.ChannelAccountTakenEncoded? value)
    {
        if (Type == "ChannelAccountTaken")
        {
            value = (Peal.ChannelAccountTakenEncoded)Value!;
            return true;
        }
        value = null;
        return false;
    }

    /// <summary>
    /// Attempts to cast the value to a <see cref="Peal.IdempotencyKeyReusedEncoded"/> and returns true if successful.
    /// </summary>
    public bool TryAsIdempotencyKeyReused(out Peal.IdempotencyKeyReusedEncoded? value)
    {
        if (Type == "IdempotencyKeyReused")
        {
            value = (Peal.IdempotencyKeyReusedEncoded)Value!;
            return true;
        }
        value = null;
        return false;
    }

    /// <summary>
    /// Attempts to cast the value to a <see cref="Peal.WorkspaceBusyEncoded"/> and returns true if successful.
    /// </summary>
    public bool TryAsWorkspaceBusy(out Peal.WorkspaceBusyEncoded? value)
    {
        if (Type == "WorkspaceBusy")
        {
            value = (Peal.WorkspaceBusyEncoded)Value!;
            return true;
        }
        value = null;
        return false;
    }

    public override string ToString() => JsonUtils.Serialize(this);

    public static implicit operator ConflictErrorBody(
        ConflictErrorBody.ChannelAccountTaken value
    ) => new(value);

    public static implicit operator ConflictErrorBody(
        ConflictErrorBody.IdempotencyKeyReused value
    ) => new(value);

    public static implicit operator ConflictErrorBody(ConflictErrorBody.WorkspaceBusy value) =>
        new(value);

    [Serializable]
    internal sealed class JsonConverter : JsonConverter<ConflictErrorBody>
    {
        public override bool CanConvert(global::System.Type typeToConvert) =>
            typeof(ConflictErrorBody).IsAssignableFrom(typeToConvert);

        public override ConflictErrorBody Read(
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
                "ChannelAccountTaken" =>
                    jsonWithoutDiscriminator.Deserialize<Peal.ChannelAccountTakenEncoded?>(options)
                        ?? throw new JsonException(
                            "Failed to deserialize Peal.ChannelAccountTakenEncoded"
                        ),
                "IdempotencyKeyReused" =>
                    jsonWithoutDiscriminator.Deserialize<Peal.IdempotencyKeyReusedEncoded?>(options)
                        ?? throw new JsonException(
                            "Failed to deserialize Peal.IdempotencyKeyReusedEncoded"
                        ),
                "WorkspaceBusy" => json.Deserialize<Peal.WorkspaceBusyEncoded?>(options)
                    ?? throw new JsonException("Failed to deserialize Peal.WorkspaceBusyEncoded"),
                _ => json.Deserialize<object?>(options),
            };
            return new ConflictErrorBody(discriminator, value);
        }

        public override void Write(
            Utf8JsonWriter writer,
            ConflictErrorBody value,
            JsonSerializerOptions options
        )
        {
            JsonNode json =
                value.Type switch
                {
                    "ChannelAccountTaken" => JsonSerializer.SerializeToNode(value.Value, options),
                    "IdempotencyKeyReused" => JsonSerializer.SerializeToNode(value.Value, options),
                    "WorkspaceBusy" => JsonSerializer.SerializeToNode(value.Value, options),
                    _ => JsonSerializer.SerializeToNode(value.Value, options),
                } ?? new JsonObject();
            json["_tag"] = value.Type;
            json.WriteTo(writer, options);
        }

        public override ConflictErrorBody ReadAsPropertyName(
            ref Utf8JsonReader reader,
            global::System.Type typeToConvert,
            JsonSerializerOptions options
        )
        {
            var stringValue =
                reader.GetString()
                ?? throw new JsonException("The JSON property name could not be read as a string.");
            return new ConflictErrorBody(stringValue, stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            ConflictErrorBody value,
            JsonSerializerOptions options
        )
        {
            writer.WritePropertyName(value.Type);
        }
    }

    /// <summary>
    /// Discriminated union type for ChannelAccountTaken
    /// </summary>
    [Serializable]
    public struct ChannelAccountTaken
    {
        public ChannelAccountTaken(Peal.ChannelAccountTakenEncoded value)
        {
            Value = value;
        }

        internal Peal.ChannelAccountTakenEncoded Value { get; set; }

        public override string ToString() => Value.ToString() ?? "null";

        public static implicit operator ConflictErrorBody.ChannelAccountTaken(
            Peal.ChannelAccountTakenEncoded value
        ) => new(value);
    }

    /// <summary>
    /// Discriminated union type for IdempotencyKeyReused
    /// </summary>
    [Serializable]
    public struct IdempotencyKeyReused
    {
        public IdempotencyKeyReused(Peal.IdempotencyKeyReusedEncoded value)
        {
            Value = value;
        }

        internal Peal.IdempotencyKeyReusedEncoded Value { get; set; }

        public override string ToString() => Value.ToString() ?? "null";

        public static implicit operator ConflictErrorBody.IdempotencyKeyReused(
            Peal.IdempotencyKeyReusedEncoded value
        ) => new(value);
    }

    /// <summary>
    /// Discriminated union type for WorkspaceBusy
    /// </summary>
    [Serializable]
    public struct WorkspaceBusy
    {
        public WorkspaceBusy(Peal.WorkspaceBusyEncoded value)
        {
            Value = value;
        }

        internal Peal.WorkspaceBusyEncoded Value { get; set; }

        public override string ToString() => Value.ToString() ?? "null";

        public static implicit operator ConflictErrorBody.WorkspaceBusy(
            Peal.WorkspaceBusyEncoded value
        ) => new(value);
    }
}
