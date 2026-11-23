// ReSharper disable NullableWarningSuppressionIsUsed
// ReSharper disable InconsistentNaming

using global::System.Text.Json;
using global::System.Text.Json.Nodes;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(PaymentRequiredErrorBody.JsonConverter))]
[Serializable]
public record PaymentRequiredErrorBody
{
    internal PaymentRequiredErrorBody(string type, object? value)
    {
        Type = type;
        Value = value;
    }

    /// <summary>
    /// Create an instance of PaymentRequiredErrorBody with <see cref="PaymentRequiredErrorBody.CompositionNeedsPayment"/>.
    /// </summary>
    public PaymentRequiredErrorBody(PaymentRequiredErrorBody.CompositionNeedsPayment value)
    {
        Type = "CompositionNeedsPayment";
        Value = value.Value;
    }

    /// <summary>
    /// Create an instance of PaymentRequiredErrorBody with <see cref="PaymentRequiredErrorBody.PlanLimitReached"/>.
    /// </summary>
    public PaymentRequiredErrorBody(PaymentRequiredErrorBody.PlanLimitReached value)
    {
        Type = "PlanLimitReached";
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
    /// Returns true if <see cref="Type"/> is "CompositionNeedsPayment"
    /// </summary>
    public bool IsCompositionNeedsPayment => Type == "CompositionNeedsPayment";

    /// <summary>
    /// Returns true if <see cref="Type"/> is "PlanLimitReached"
    /// </summary>
    public bool IsPlanLimitReached => Type == "PlanLimitReached";

    /// <summary>
    /// Returns the value as a <see cref="Peal.CompositionNeedsPaymentEncoded"/> if <see cref="Type"/> is 'CompositionNeedsPayment', otherwise throws an exception.
    /// </summary>
    /// <exception cref="Exception">Thrown when <see cref="Type"/> is not 'CompositionNeedsPayment'.</exception>
    public Peal.CompositionNeedsPaymentEncoded AsCompositionNeedsPayment() =>
        IsCompositionNeedsPayment
            ? (Peal.CompositionNeedsPaymentEncoded)Value!
            : throw new global::System.Exception(
                "PaymentRequiredErrorBody.Type is not 'CompositionNeedsPayment'"
            );

    /// <summary>
    /// Returns the value as a <see cref="Peal.PlanLimitReachedEncoded"/> if <see cref="Type"/> is 'PlanLimitReached', otherwise throws an exception.
    /// </summary>
    /// <exception cref="Exception">Thrown when <see cref="Type"/> is not 'PlanLimitReached'.</exception>
    public Peal.PlanLimitReachedEncoded AsPlanLimitReached() =>
        IsPlanLimitReached
            ? (Peal.PlanLimitReachedEncoded)Value!
            : throw new global::System.Exception(
                "PaymentRequiredErrorBody.Type is not 'PlanLimitReached'"
            );

    public T Match<T>(
        Func<Peal.CompositionNeedsPaymentEncoded, T> onCompositionNeedsPayment,
        Func<Peal.PlanLimitReachedEncoded, T> onPlanLimitReached,
        Func<string, object?, T> onUnknown_
    )
    {
        return Type switch
        {
            "CompositionNeedsPayment" => onCompositionNeedsPayment(AsCompositionNeedsPayment()),
            "PlanLimitReached" => onPlanLimitReached(AsPlanLimitReached()),
            _ => onUnknown_(Type, Value),
        };
    }

    public void Visit(
        Action<Peal.CompositionNeedsPaymentEncoded> onCompositionNeedsPayment,
        Action<Peal.PlanLimitReachedEncoded> onPlanLimitReached,
        Action<string, object?> onUnknown_
    )
    {
        switch (Type)
        {
            case "CompositionNeedsPayment":
                onCompositionNeedsPayment(AsCompositionNeedsPayment());
                break;
            case "PlanLimitReached":
                onPlanLimitReached(AsPlanLimitReached());
                break;
            default:
                onUnknown_(Type, Value);
                break;
        }
    }

    /// <summary>
    /// Attempts to cast the value to a <see cref="Peal.CompositionNeedsPaymentEncoded"/> and returns true if successful.
    /// </summary>
    public bool TryAsCompositionNeedsPayment(out Peal.CompositionNeedsPaymentEncoded? value)
    {
        if (Type == "CompositionNeedsPayment")
        {
            value = (Peal.CompositionNeedsPaymentEncoded)Value!;
            return true;
        }
        value = null;
        return false;
    }

    /// <summary>
    /// Attempts to cast the value to a <see cref="Peal.PlanLimitReachedEncoded"/> and returns true if successful.
    /// </summary>
    public bool TryAsPlanLimitReached(out Peal.PlanLimitReachedEncoded? value)
    {
        if (Type == "PlanLimitReached")
        {
            value = (Peal.PlanLimitReachedEncoded)Value!;
            return true;
        }
        value = null;
        return false;
    }

    public override string ToString() => JsonUtils.Serialize(this);

    public static implicit operator PaymentRequiredErrorBody(
        PaymentRequiredErrorBody.CompositionNeedsPayment value
    ) => new(value);

    public static implicit operator PaymentRequiredErrorBody(
        PaymentRequiredErrorBody.PlanLimitReached value
    ) => new(value);

    [Serializable]
    internal sealed class JsonConverter : JsonConverter<PaymentRequiredErrorBody>
    {
        public override bool CanConvert(global::System.Type typeToConvert) =>
            typeof(PaymentRequiredErrorBody).IsAssignableFrom(typeToConvert);

        public override PaymentRequiredErrorBody Read(
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
                "CompositionNeedsPayment" =>
                    jsonWithoutDiscriminator.Deserialize<Peal.CompositionNeedsPaymentEncoded?>(
                        options
                    )
                        ?? throw new JsonException(
                            "Failed to deserialize Peal.CompositionNeedsPaymentEncoded"
                        ),
                "PlanLimitReached" => json.Deserialize<Peal.PlanLimitReachedEncoded?>(options)
                    ?? throw new JsonException(
                        "Failed to deserialize Peal.PlanLimitReachedEncoded"
                    ),
                _ => json.Deserialize<object?>(options),
            };
            return new PaymentRequiredErrorBody(discriminator, value);
        }

        public override void Write(
            Utf8JsonWriter writer,
            PaymentRequiredErrorBody value,
            JsonSerializerOptions options
        )
        {
            JsonNode json =
                value.Type switch
                {
                    "CompositionNeedsPayment" => JsonSerializer.SerializeToNode(
                        value.Value,
                        options
                    ),
                    "PlanLimitReached" => JsonSerializer.SerializeToNode(value.Value, options),
                    _ => JsonSerializer.SerializeToNode(value.Value, options),
                } ?? new JsonObject();
            json["_tag"] = value.Type;
            json.WriteTo(writer, options);
        }

        public override PaymentRequiredErrorBody ReadAsPropertyName(
            ref Utf8JsonReader reader,
            global::System.Type typeToConvert,
            JsonSerializerOptions options
        )
        {
            var stringValue =
                reader.GetString()
                ?? throw new JsonException("The JSON property name could not be read as a string.");
            return new PaymentRequiredErrorBody(stringValue, stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            PaymentRequiredErrorBody value,
            JsonSerializerOptions options
        )
        {
            writer.WritePropertyName(value.Type);
        }
    }

    /// <summary>
    /// Discriminated union type for CompositionNeedsPayment
    /// </summary>
    [Serializable]
    public struct CompositionNeedsPayment
    {
        public CompositionNeedsPayment(Peal.CompositionNeedsPaymentEncoded value)
        {
            Value = value;
        }

        internal Peal.CompositionNeedsPaymentEncoded Value { get; set; }

        public override string ToString() => Value.ToString() ?? "null";

        public static implicit operator PaymentRequiredErrorBody.CompositionNeedsPayment(
            Peal.CompositionNeedsPaymentEncoded value
        ) => new(value);
    }

    /// <summary>
    /// Discriminated union type for PlanLimitReached
    /// </summary>
    [Serializable]
    public struct PlanLimitReached
    {
        public PlanLimitReached(Peal.PlanLimitReachedEncoded value)
        {
            Value = value;
        }

        internal Peal.PlanLimitReachedEncoded Value { get; set; }

        public override string ToString() => Value.ToString() ?? "null";

        public static implicit operator PaymentRequiredErrorBody.PlanLimitReached(
            Peal.PlanLimitReachedEncoded value
        ) => new(value);
    }
}
