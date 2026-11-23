using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(SlideMotion.SlideMotionSerializer))]
[Serializable]
public readonly record struct SlideMotion : IStringEnum
{
    public static readonly SlideMotion None = new(Values.None);

    public static readonly SlideMotion ZoomIn = new(Values.ZoomIn);

    public static readonly SlideMotion ZoomOut = new(Values.ZoomOut);

    public static readonly SlideMotion Slide = new(Values.Slide);

    public SlideMotion(string value)
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
    public static SlideMotion FromCustom(string value)
    {
        return new SlideMotion(value);
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

    public static bool operator ==(SlideMotion value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(SlideMotion value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(SlideMotion value) => value.Value;

    public static explicit operator SlideMotion(string value) => new(value);

    internal class SlideMotionSerializer : JsonConverter<SlideMotion>
    {
        public override SlideMotion Read(
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
            return new SlideMotion(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            SlideMotion value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override SlideMotion ReadAsPropertyName(
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
            return new SlideMotion(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            SlideMotion value,
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
        public const string None = "none";

        public const string ZoomIn = "zoomIn";

        public const string ZoomOut = "zoomOut";

        public const string Slide = "slide";
    }
}
