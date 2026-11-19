using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(BrowserAnalyticsConsent.BrowserAnalyticsConsentSerializer))]
[Serializable]
public readonly record struct BrowserAnalyticsConsent : IStringEnum
{
    public static readonly BrowserAnalyticsConsent Undecided = new(Values.Undecided);

    public static readonly BrowserAnalyticsConsent Granted = new(Values.Granted);

    public static readonly BrowserAnalyticsConsent Refused = new(Values.Refused);

    public BrowserAnalyticsConsent(string value)
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
    public static BrowserAnalyticsConsent FromCustom(string value)
    {
        return new BrowserAnalyticsConsent(value);
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

    public static bool operator ==(BrowserAnalyticsConsent value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(BrowserAnalyticsConsent value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(BrowserAnalyticsConsent value) => value.Value;

    public static explicit operator BrowserAnalyticsConsent(string value) => new(value);

    internal class BrowserAnalyticsConsentSerializer : JsonConverter<BrowserAnalyticsConsent>
    {
        public override BrowserAnalyticsConsent Read(
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
            return new BrowserAnalyticsConsent(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            BrowserAnalyticsConsent value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override BrowserAnalyticsConsent ReadAsPropertyName(
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
            return new BrowserAnalyticsConsent(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            BrowserAnalyticsConsent value,
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
        public const string Undecided = "undecided";

        public const string Granted = "granted";

        public const string Refused = "refused";
    }
}
