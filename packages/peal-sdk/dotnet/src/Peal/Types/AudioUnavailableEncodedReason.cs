using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(AudioUnavailableEncodedReason.AudioUnavailableEncodedReasonSerializer))]
[Serializable]
public readonly record struct AudioUnavailableEncodedReason : IStringEnum
{
    public static readonly AudioUnavailableEncodedReason NotSet = new(Values.NotSet);

    public static readonly AudioUnavailableEncodedReason KeyUnreadable = new(Values.KeyUnreadable);

    public AudioUnavailableEncodedReason(string value)
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
    public static AudioUnavailableEncodedReason FromCustom(string value)
    {
        return new AudioUnavailableEncodedReason(value);
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

    public static bool operator ==(AudioUnavailableEncodedReason value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(AudioUnavailableEncodedReason value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(AudioUnavailableEncodedReason value) => value.Value;

    public static explicit operator AudioUnavailableEncodedReason(string value) => new(value);

    internal class AudioUnavailableEncodedReasonSerializer
        : JsonConverter<AudioUnavailableEncodedReason>
    {
        public override AudioUnavailableEncodedReason Read(
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
            return new AudioUnavailableEncodedReason(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            AudioUnavailableEncodedReason value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override AudioUnavailableEncodedReason ReadAsPropertyName(
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
            return new AudioUnavailableEncodedReason(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            AudioUnavailableEncodedReason value,
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
