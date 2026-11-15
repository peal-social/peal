using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(OAuthSitePlatform.OAuthSitePlatformSerializer))]
[Serializable]
public readonly record struct OAuthSitePlatform : IStringEnum
{
    public static readonly OAuthSitePlatform WordpressCom = new(Values.WordpressCom);

    public OAuthSitePlatform(string value)
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
    public static OAuthSitePlatform FromCustom(string value)
    {
        return new OAuthSitePlatform(value);
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

    public static bool operator ==(OAuthSitePlatform value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(OAuthSitePlatform value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(OAuthSitePlatform value) => value.Value;

    public static explicit operator OAuthSitePlatform(string value) => new(value);

    internal class OAuthSitePlatformSerializer : JsonConverter<OAuthSitePlatform>
    {
        public override OAuthSitePlatform Read(
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
            return new OAuthSitePlatform(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            OAuthSitePlatform value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override OAuthSitePlatform ReadAsPropertyName(
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
            return new OAuthSitePlatform(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            OAuthSitePlatform value,
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
        public const string WordpressCom = "wordpressCom";
    }
}
