using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(VideoUnavailableEncodedTag.VideoUnavailableEncodedTagSerializer))]
[Serializable]
public readonly record struct VideoUnavailableEncodedTag : IStringEnum
{
    public static readonly VideoUnavailableEncodedTag VideoUnavailable = new(
        Values.VideoUnavailable
    );

    public VideoUnavailableEncodedTag(string value)
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
    public static VideoUnavailableEncodedTag FromCustom(string value)
    {
        return new VideoUnavailableEncodedTag(value);
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

    public static bool operator ==(VideoUnavailableEncodedTag value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(VideoUnavailableEncodedTag value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(VideoUnavailableEncodedTag value) => value.Value;

    public static explicit operator VideoUnavailableEncodedTag(string value) => new(value);

    internal class VideoUnavailableEncodedTagSerializer : JsonConverter<VideoUnavailableEncodedTag>
    {
        public override VideoUnavailableEncodedTag Read(
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
            return new VideoUnavailableEncodedTag(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            VideoUnavailableEncodedTag value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override VideoUnavailableEncodedTag ReadAsPropertyName(
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
            return new VideoUnavailableEncodedTag(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            VideoUnavailableEncodedTag value,
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
        public const string VideoUnavailable = "VideoUnavailable";
    }
}
