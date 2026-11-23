using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(
    typeof(SlideshowRequestRejectedEncodedTag.SlideshowRequestRejectedEncodedTagSerializer)
)]
[Serializable]
public readonly record struct SlideshowRequestRejectedEncodedTag : IStringEnum
{
    public static readonly SlideshowRequestRejectedEncodedTag SlideshowRequestRejected = new(
        Values.SlideshowRequestRejected
    );

    public SlideshowRequestRejectedEncodedTag(string value)
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
    public static SlideshowRequestRejectedEncodedTag FromCustom(string value)
    {
        return new SlideshowRequestRejectedEncodedTag(value);
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

    public static bool operator ==(SlideshowRequestRejectedEncodedTag value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(SlideshowRequestRejectedEncodedTag value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(SlideshowRequestRejectedEncodedTag value) => value.Value;

    public static explicit operator SlideshowRequestRejectedEncodedTag(string value) => new(value);

    internal class SlideshowRequestRejectedEncodedTagSerializer
        : JsonConverter<SlideshowRequestRejectedEncodedTag>
    {
        public override SlideshowRequestRejectedEncodedTag Read(
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
            return new SlideshowRequestRejectedEncodedTag(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            SlideshowRequestRejectedEncodedTag value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override SlideshowRequestRejectedEncodedTag ReadAsPropertyName(
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
            return new SlideshowRequestRejectedEncodedTag(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            SlideshowRequestRejectedEncodedTag value,
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
        public const string SlideshowRequestRejected = "SlideshowRequestRejected";
    }
}
