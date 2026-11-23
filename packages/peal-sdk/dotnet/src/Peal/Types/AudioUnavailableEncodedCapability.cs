using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(
    typeof(AudioUnavailableEncodedCapability.AudioUnavailableEncodedCapabilitySerializer)
)]
[Serializable]
public readonly record struct AudioUnavailableEncodedCapability : IStringEnum
{
    public static readonly AudioUnavailableEncodedCapability Speech = new(Values.Speech);

    public static readonly AudioUnavailableEncodedCapability Transcription = new(
        Values.Transcription
    );

    public AudioUnavailableEncodedCapability(string value)
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
    public static AudioUnavailableEncodedCapability FromCustom(string value)
    {
        return new AudioUnavailableEncodedCapability(value);
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

    public static bool operator ==(AudioUnavailableEncodedCapability value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(AudioUnavailableEncodedCapability value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(AudioUnavailableEncodedCapability value) => value.Value;

    public static explicit operator AudioUnavailableEncodedCapability(string value) => new(value);

    internal class AudioUnavailableEncodedCapabilitySerializer
        : JsonConverter<AudioUnavailableEncodedCapability>
    {
        public override AudioUnavailableEncodedCapability Read(
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
            return new AudioUnavailableEncodedCapability(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            AudioUnavailableEncodedCapability value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override AudioUnavailableEncodedCapability ReadAsPropertyName(
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
            return new AudioUnavailableEncodedCapability(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            AudioUnavailableEncodedCapability value,
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
        public const string Speech = "speech";

        public const string Transcription = "transcription";
    }
}
