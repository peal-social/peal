using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(AiCapability.AiCapabilitySerializer))]
[Serializable]
public readonly record struct AiCapability : IStringEnum
{
    public static readonly AiCapability Text = new(Values.Text);

    public static readonly AiCapability Image = new(Values.Image);

    public static readonly AiCapability Video = new(Values.Video);

    public static readonly AiCapability Speech = new(Values.Speech);

    public static readonly AiCapability Transcription = new(Values.Transcription);

    public static readonly AiCapability Composition = new(Values.Composition);

    public AiCapability(string value)
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
    public static AiCapability FromCustom(string value)
    {
        return new AiCapability(value);
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

    public static bool operator ==(AiCapability value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(AiCapability value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(AiCapability value) => value.Value;

    public static explicit operator AiCapability(string value) => new(value);

    internal class AiCapabilitySerializer : JsonConverter<AiCapability>
    {
        public override AiCapability Read(
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
            return new AiCapability(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            AiCapability value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override AiCapability ReadAsPropertyName(
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
            return new AiCapability(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            AiCapability value,
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
        public const string Text = "text";

        public const string Image = "image";

        public const string Video = "video";

        public const string Speech = "speech";

        public const string Transcription = "transcription";

        public const string Composition = "composition";
    }
}
