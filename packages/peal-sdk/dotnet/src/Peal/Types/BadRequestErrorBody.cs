// ReSharper disable NullableWarningSuppressionIsUsed
// ReSharper disable InconsistentNaming

using global::System.Text.Json;
using global::System.Text.Json.Nodes;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(BadRequestErrorBody.JsonConverter))]
[Serializable]
public record BadRequestErrorBody
{
    internal BadRequestErrorBody(string type, object? value)
    {
        Type = type;
        Value = value;
    }

    /// <summary>
    /// Create an instance of BadRequestErrorBody with <see cref="BadRequestErrorBody.InvalidDateRange"/>.
    /// </summary>
    public BadRequestErrorBody(BadRequestErrorBody.InvalidDateRange value)
    {
        Type = "InvalidDateRange";
        Value = value.Value;
    }

    /// <summary>
    /// Create an instance of BadRequestErrorBody with <see cref="BadRequestErrorBody.WorkspaceRequired"/>.
    /// </summary>
    public BadRequestErrorBody(BadRequestErrorBody.WorkspaceRequired value)
    {
        Type = "WorkspaceRequired";
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
    /// Returns true if <see cref="Type"/> is "InvalidDateRange"
    /// </summary>
    public bool IsInvalidDateRange => Type == "InvalidDateRange";

    /// <summary>
    /// Returns true if <see cref="Type"/> is "WorkspaceRequired"
    /// </summary>
    public bool IsWorkspaceRequired => Type == "WorkspaceRequired";

    /// <summary>
    /// Returns the value as a <see cref="Peal.InvalidDateRangeEncoded"/> if <see cref="Type"/> is 'InvalidDateRange', otherwise throws an exception.
    /// </summary>
    /// <exception cref="Exception">Thrown when <see cref="Type"/> is not 'InvalidDateRange'.</exception>
    public Peal.InvalidDateRangeEncoded AsInvalidDateRange() =>
        IsInvalidDateRange
            ? (Peal.InvalidDateRangeEncoded)Value!
            : throw new global::System.Exception(
                "BadRequestErrorBody.Type is not 'InvalidDateRange'"
            );

    /// <summary>
    /// Returns the value as a <see cref="Peal.WorkspaceRequiredEncoded"/> if <see cref="Type"/> is 'WorkspaceRequired', otherwise throws an exception.
    /// </summary>
    /// <exception cref="Exception">Thrown when <see cref="Type"/> is not 'WorkspaceRequired'.</exception>
    public Peal.WorkspaceRequiredEncoded AsWorkspaceRequired() =>
        IsWorkspaceRequired
            ? (Peal.WorkspaceRequiredEncoded)Value!
            : throw new global::System.Exception(
                "BadRequestErrorBody.Type is not 'WorkspaceRequired'"
            );

    public T Match<T>(
        Func<Peal.InvalidDateRangeEncoded, T> onInvalidDateRange,
        Func<Peal.WorkspaceRequiredEncoded, T> onWorkspaceRequired,
        Func<string, object?, T> onUnknown_
    )
    {
        return Type switch
        {
            "InvalidDateRange" => onInvalidDateRange(AsInvalidDateRange()),
            "WorkspaceRequired" => onWorkspaceRequired(AsWorkspaceRequired()),
            _ => onUnknown_(Type, Value),
        };
    }

    public void Visit(
        Action<Peal.InvalidDateRangeEncoded> onInvalidDateRange,
        Action<Peal.WorkspaceRequiredEncoded> onWorkspaceRequired,
        Action<string, object?> onUnknown_
    )
    {
        switch (Type)
        {
            case "InvalidDateRange":
                onInvalidDateRange(AsInvalidDateRange());
                break;
            case "WorkspaceRequired":
                onWorkspaceRequired(AsWorkspaceRequired());
                break;
            default:
                onUnknown_(Type, Value);
                break;
        }
    }

    /// <summary>
    /// Attempts to cast the value to a <see cref="Peal.InvalidDateRangeEncoded"/> and returns true if successful.
    /// </summary>
    public bool TryAsInvalidDateRange(out Peal.InvalidDateRangeEncoded? value)
    {
        if (Type == "InvalidDateRange")
        {
            value = (Peal.InvalidDateRangeEncoded)Value!;
            return true;
        }
        value = null;
        return false;
    }

    /// <summary>
    /// Attempts to cast the value to a <see cref="Peal.WorkspaceRequiredEncoded"/> and returns true if successful.
    /// </summary>
    public bool TryAsWorkspaceRequired(out Peal.WorkspaceRequiredEncoded? value)
    {
        if (Type == "WorkspaceRequired")
        {
            value = (Peal.WorkspaceRequiredEncoded)Value!;
            return true;
        }
        value = null;
        return false;
    }

    public override string ToString() => JsonUtils.Serialize(this);

    public static implicit operator BadRequestErrorBody(
        BadRequestErrorBody.InvalidDateRange value
    ) => new(value);

    public static implicit operator BadRequestErrorBody(
        BadRequestErrorBody.WorkspaceRequired value
    ) => new(value);

    [Serializable]
    internal sealed class JsonConverter : JsonConverter<BadRequestErrorBody>
    {
        public override bool CanConvert(global::System.Type typeToConvert) =>
            typeof(BadRequestErrorBody).IsAssignableFrom(typeToConvert);

        public override BadRequestErrorBody Read(
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
                "InvalidDateRange" =>
                    jsonWithoutDiscriminator.Deserialize<Peal.InvalidDateRangeEncoded?>(options)
                        ?? throw new JsonException(
                            "Failed to deserialize Peal.InvalidDateRangeEncoded"
                        ),
                "WorkspaceRequired" => json.Deserialize<Peal.WorkspaceRequiredEncoded?>(options)
                    ?? throw new JsonException(
                        "Failed to deserialize Peal.WorkspaceRequiredEncoded"
                    ),
                _ => json.Deserialize<object?>(options),
            };
            return new BadRequestErrorBody(discriminator, value);
        }

        public override void Write(
            Utf8JsonWriter writer,
            BadRequestErrorBody value,
            JsonSerializerOptions options
        )
        {
            JsonNode json =
                value.Type switch
                {
                    "InvalidDateRange" => JsonSerializer.SerializeToNode(value.Value, options),
                    "WorkspaceRequired" => JsonSerializer.SerializeToNode(value.Value, options),
                    _ => JsonSerializer.SerializeToNode(value.Value, options),
                } ?? new JsonObject();
            json["_tag"] = value.Type;
            json.WriteTo(writer, options);
        }

        public override BadRequestErrorBody ReadAsPropertyName(
            ref Utf8JsonReader reader,
            global::System.Type typeToConvert,
            JsonSerializerOptions options
        )
        {
            var stringValue =
                reader.GetString()
                ?? throw new JsonException("The JSON property name could not be read as a string.");
            return new BadRequestErrorBody(stringValue, stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            BadRequestErrorBody value,
            JsonSerializerOptions options
        )
        {
            writer.WritePropertyName(value.Type);
        }
    }

    /// <summary>
    /// Discriminated union type for InvalidDateRange
    /// </summary>
    [Serializable]
    public struct InvalidDateRange
    {
        public InvalidDateRange(Peal.InvalidDateRangeEncoded value)
        {
            Value = value;
        }

        internal Peal.InvalidDateRangeEncoded Value { get; set; }

        public override string ToString() => Value.ToString() ?? "null";

        public static implicit operator BadRequestErrorBody.InvalidDateRange(
            Peal.InvalidDateRangeEncoded value
        ) => new(value);
    }

    /// <summary>
    /// Discriminated union type for WorkspaceRequired
    /// </summary>
    [Serializable]
    public struct WorkspaceRequired
    {
        public WorkspaceRequired(Peal.WorkspaceRequiredEncoded value)
        {
            Value = value;
        }

        internal Peal.WorkspaceRequiredEncoded Value { get; set; }

        public override string ToString() => Value.ToString() ?? "null";

        public static implicit operator BadRequestErrorBody.WorkspaceRequired(
            Peal.WorkspaceRequiredEncoded value
        ) => new(value);
    }
}
