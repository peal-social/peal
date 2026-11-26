using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(SiteStatusOption.SiteStatusOptionSerializer))]
[Serializable]
public readonly record struct SiteStatusOption : IStringEnum
{
    public static readonly SiteStatusOption Publish = new(Values.Publish);

    public static readonly SiteStatusOption Draft = new(Values.Draft);

    public SiteStatusOption(string value)
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
    public static SiteStatusOption FromCustom(string value)
    {
        return new SiteStatusOption(value);
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

    public static bool operator ==(SiteStatusOption value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(SiteStatusOption value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(SiteStatusOption value) => value.Value;

    public static explicit operator SiteStatusOption(string value) => new(value);

    internal class SiteStatusOptionSerializer : JsonConverter<SiteStatusOption>
    {
        public override SiteStatusOption Read(
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
            return new SiteStatusOption(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            SiteStatusOption value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override SiteStatusOption ReadAsPropertyName(
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
            return new SiteStatusOption(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            SiteStatusOption value,
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
        public const string Publish = "publish";

        public const string Draft = "draft";
    }
}
