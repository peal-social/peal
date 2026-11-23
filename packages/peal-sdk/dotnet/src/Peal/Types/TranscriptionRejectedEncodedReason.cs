using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(
    typeof(TranscriptionRejectedEncodedReason.TranscriptionRejectedEncodedReasonSerializer)
)]
[Serializable]
public readonly record struct TranscriptionRejectedEncodedReason : IStringEnum
{
    public static readonly TranscriptionRejectedEncodedReason NotAudio = new(Values.NotAudio);

    public static readonly TranscriptionRejectedEncodedReason NotReady = new(Values.NotReady);

    public static readonly TranscriptionRejectedEncodedReason TooLarge = new(Values.TooLarge);

    public TranscriptionRejectedEncodedReason(string value)
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
    public static TranscriptionRejectedEncodedReason FromCustom(string value)
    {
        return new TranscriptionRejectedEncodedReason(value);
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

    public static bool operator ==(TranscriptionRejectedEncodedReason value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(TranscriptionRejectedEncodedReason value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(TranscriptionRejectedEncodedReason value) => value.Value;

    public static explicit operator TranscriptionRejectedEncodedReason(string value) => new(value);

    internal class TranscriptionRejectedEncodedReasonSerializer
        : JsonConverter<TranscriptionRejectedEncodedReason>
    {
        public override TranscriptionRejectedEncodedReason Read(
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
            return new TranscriptionRejectedEncodedReason(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            TranscriptionRejectedEncodedReason value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override TranscriptionRejectedEncodedReason ReadAsPropertyName(
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
            return new TranscriptionRejectedEncodedReason(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            TranscriptionRejectedEncodedReason value,
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
        public const string NotAudio = "notAudio";

        public const string NotReady = "notReady";

        public const string TooLarge = "tooLarge";
    }
}
