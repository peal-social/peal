using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(KeySitePlatform.KeySitePlatformSerializer))]
[Serializable]
public readonly record struct KeySitePlatform : IStringEnum
{
    public static readonly KeySitePlatform Devto = new(Values.Devto);

    public static readonly KeySitePlatform Hashnode = new(Values.Hashnode);

    public KeySitePlatform(string value)
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
    public static KeySitePlatform FromCustom(string value)
    {
        return new KeySitePlatform(value);
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

    public static bool operator ==(KeySitePlatform value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(KeySitePlatform value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(KeySitePlatform value) => value.Value;

    public static explicit operator KeySitePlatform(string value) => new(value);

    internal class KeySitePlatformSerializer : JsonConverter<KeySitePlatform>
    {
        public override KeySitePlatform Read(
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
            return new KeySitePlatform(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            KeySitePlatform value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override KeySitePlatform ReadAsPropertyName(
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
            return new KeySitePlatform(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            KeySitePlatform value,
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
        public const string Devto = "devto";

        public const string Hashnode = "hashnode";
    }
}
