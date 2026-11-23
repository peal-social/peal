using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(TranscriptionRejectedEncodedTag.TranscriptionRejectedEncodedTagSerializer))]
[Serializable]
public readonly record struct TranscriptionRejectedEncodedTag : IStringEnum
{
    public static readonly TranscriptionRejectedEncodedTag TranscriptionRejected = new(
        Values.TranscriptionRejected
    );

    public TranscriptionRejectedEncodedTag(string value)
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
    public static TranscriptionRejectedEncodedTag FromCustom(string value)
    {
        return new TranscriptionRejectedEncodedTag(value);
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

    public static bool operator ==(TranscriptionRejectedEncodedTag value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(TranscriptionRejectedEncodedTag value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(TranscriptionRejectedEncodedTag value) => value.Value;

    public static explicit operator TranscriptionRejectedEncodedTag(string value) => new(value);

    internal class TranscriptionRejectedEncodedTagSerializer
        : JsonConverter<TranscriptionRejectedEncodedTag>
    {
        public override TranscriptionRejectedEncodedTag Read(
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
            return new TranscriptionRejectedEncodedTag(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            TranscriptionRejectedEncodedTag value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override TranscriptionRejectedEncodedTag ReadAsPropertyName(
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
            return new TranscriptionRejectedEncodedTag(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            TranscriptionRejectedEncodedTag value,
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
        public const string TranscriptionRejected = "TranscriptionRejected";
    }
}
