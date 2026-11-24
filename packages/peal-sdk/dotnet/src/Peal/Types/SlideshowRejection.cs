using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(SlideshowRejection.SlideshowRejectionSerializer))]
[Serializable]
public readonly record struct SlideshowRejection : IStringEnum
{
    public static readonly SlideshowRejection ImageNotFound = new(Values.ImageNotFound);

    public static readonly SlideshowRejection ImageNotSupported = new(Values.ImageNotSupported);

    public static readonly SlideshowRejection VoiceoverNotFound = new(Values.VoiceoverNotFound);

    public static readonly SlideshowRejection TooLong = new(Values.TooLong);

    public static readonly SlideshowRejection VoiceoverTooLong = new(Values.VoiceoverTooLong);

    public static readonly SlideshowRejection VoiceoverTooShort = new(Values.VoiceoverTooShort);

    public static readonly SlideshowRejection EditInvalid = new(Values.EditInvalid);

    public static readonly SlideshowRejection MediaNotFound = new(Values.MediaNotFound);

    public static readonly SlideshowRejection MediaNotSupported = new(Values.MediaNotSupported);

    public static readonly SlideshowRejection EditTooLong = new(Values.EditTooLong);

    public static readonly SlideshowRejection EditTooLarge = new(Values.EditTooLarge);

    public static readonly SlideshowRejection OutputNotSupported = new(Values.OutputNotSupported);

    public SlideshowRejection(string value)
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
    public static SlideshowRejection FromCustom(string value)
    {
        return new SlideshowRejection(value);
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

    public static bool operator ==(SlideshowRejection value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(SlideshowRejection value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(SlideshowRejection value) => value.Value;

    public static explicit operator SlideshowRejection(string value) => new(value);

    internal class SlideshowRejectionSerializer : JsonConverter<SlideshowRejection>
    {
        public override SlideshowRejection Read(
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
            return new SlideshowRejection(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            SlideshowRejection value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override SlideshowRejection ReadAsPropertyName(
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
            return new SlideshowRejection(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            SlideshowRejection value,
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
        public const string ImageNotFound = "imageNotFound";

        public const string ImageNotSupported = "imageNotSupported";

        public const string VoiceoverNotFound = "voiceoverNotFound";

        public const string TooLong = "tooLong";

        public const string VoiceoverTooLong = "voiceoverTooLong";

        public const string VoiceoverTooShort = "voiceoverTooShort";

        public const string EditInvalid = "editInvalid";

        public const string MediaNotFound = "mediaNotFound";

        public const string MediaNotSupported = "mediaNotSupported";

        public const string EditTooLong = "editTooLong";

        public const string EditTooLarge = "editTooLarge";

        public const string OutputNotSupported = "outputNotSupported";
    }
}
