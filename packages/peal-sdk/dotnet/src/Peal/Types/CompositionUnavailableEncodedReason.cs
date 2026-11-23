using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(
    typeof(CompositionUnavailableEncodedReason.CompositionUnavailableEncodedReasonSerializer)
)]
[Serializable]
public readonly record struct CompositionUnavailableEncodedReason : IStringEnum
{
    public static readonly CompositionUnavailableEncodedReason NotSet = new(Values.NotSet);

    public static readonly CompositionUnavailableEncodedReason KeyUnreadable = new(
        Values.KeyUnreadable
    );

    public CompositionUnavailableEncodedReason(string value)
    {
        Value = value;
    }

    /// <summary>
    /// The string value of the enum.
    /// </summary>
    public string Value { get; }

    /// <summary>
    /// Create a string enum with the given value.
    /// </summary>
    public static CompositionUnavailableEncodedReason FromCustom(string value)
    {
        return new CompositionUnavailableEncodedReason(value);
    }

    public bool Equals(string? other)
    {
        return Value.Equals(other);
    }

    /// <summary>
    /// Returns the string value of the enum.
    /// </summary>
    public override string ToString()
    {
        return Value;
    }

    public static bool operator ==(CompositionUnavailableEncodedReason value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(CompositionUnavailableEncodedReason value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(CompositionUnavailableEncodedReason value) =>
        value.Value;

    public static explicit operator CompositionUnavailableEncodedReason(string value) => new(value);

    internal class CompositionUnavailableEncodedReasonSerializer
        : JsonConverter<CompositionUnavailableEncodedReason>
    {
        public override CompositionUnavailableEncodedReason Read(
            ref Utf8JsonReader reader,
            Type typeToConvert,
            JsonSerializerOptions options
        )
        {
            var stringValue =
                reader.GetString()
                ?? throw new global::System.Exception(
                    "The JSON value could not be read as a string."
                );
            return new CompositionUnavailableEncodedReason(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            CompositionUnavailableEncodedReason value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override CompositionUnavailableEncodedReason ReadAsPropertyName(
            ref Utf8JsonReader reader,
            Type typeToConvert,
            JsonSerializerOptions options
        )
        {
            var stringValue =
                reader.GetString()
                ?? throw new global::System.Exception(
                    "The JSON property name could not be read as a string."
                );
            return new CompositionUnavailableEncodedReason(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            CompositionUnavailableEncodedReason value,
            JsonSerializerOptions options
        )
        {
            writer.WritePropertyName(value.Value);
        }
    }

    /// <summary>
    /// Constant strings for enum values
    /// </summary>
    [Serializable]
    public static class Values
    {
        public const string NotSet = "notSet";

        public const string KeyUnreadable = "keyUnreadable";
    }
}
