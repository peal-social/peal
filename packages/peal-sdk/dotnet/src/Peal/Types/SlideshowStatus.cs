using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(SlideshowStatus.SlideshowStatusSerializer))]
[Serializable]
public readonly record struct SlideshowStatus : IStringEnum
{
    public static readonly SlideshowStatus Queued = new(Values.Queued);

    public static readonly SlideshowStatus Running = new(Values.Running);

    public static readonly SlideshowStatus Succeeded = new(Values.Succeeded);

    public static readonly SlideshowStatus Failed = new(Values.Failed);

    public SlideshowStatus(string value)
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
    public static SlideshowStatus FromCustom(string value)
    {
        return new SlideshowStatus(value);
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

    public static bool operator ==(SlideshowStatus value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(SlideshowStatus value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(SlideshowStatus value) => value.Value;

    public static explicit operator SlideshowStatus(string value) => new(value);

    internal class SlideshowStatusSerializer : JsonConverter<SlideshowStatus>
    {
        public override SlideshowStatus Read(
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
            return new SlideshowStatus(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            SlideshowStatus value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override SlideshowStatus ReadAsPropertyName(
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
            return new SlideshowStatus(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            SlideshowStatus value,
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
        public const string Queued = "queued";

        public const string Running = "running";

        public const string Succeeded = "succeeded";

        public const string Failed = "failed";
    }
}
