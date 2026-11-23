using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(
    typeof(AudioProviderFailedEncodedCapability.AudioProviderFailedEncodedCapabilitySerializer)
)]
[Serializable]
public readonly record struct AudioProviderFailedEncodedCapability : IStringEnum
{
    public static readonly AudioProviderFailedEncodedCapability Speech = new(Values.Speech);

    public static readonly AudioProviderFailedEncodedCapability Transcription = new(
        Values.Transcription
    );

    public AudioProviderFailedEncodedCapability(string value)
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
    public static AudioProviderFailedEncodedCapability FromCustom(string value)
    {
        return new AudioProviderFailedEncodedCapability(value);
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

    public static bool operator ==(AudioProviderFailedEncodedCapability value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(AudioProviderFailedEncodedCapability value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(AudioProviderFailedEncodedCapability value) =>
        value.Value;

    public static explicit operator AudioProviderFailedEncodedCapability(string value) =>
        new(value);

    internal class AudioProviderFailedEncodedCapabilitySerializer
        : JsonConverter<AudioProviderFailedEncodedCapability>
    {
        public override AudioProviderFailedEncodedCapability Read(
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
            return new AudioProviderFailedEncodedCapability(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            AudioProviderFailedEncodedCapability value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override AudioProviderFailedEncodedCapability ReadAsPropertyName(
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
            return new AudioProviderFailedEncodedCapability(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            AudioProviderFailedEncodedCapability value,
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
