using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(PlatformCommentRulePrivate.PlatformCommentRulePrivateSerializer))]
[Serializable]
public readonly record struct PlatformCommentRulePrivate : IStringEnum
{
    public static readonly PlatformCommentRulePrivate Available = new(Values.Available);

    public static readonly PlatformCommentRulePrivate NoApi = new(Values.NoApi);

    public static readonly PlatformCommentRulePrivate Unsupported = new(Values.Unsupported);

    public PlatformCommentRulePrivate(string value)
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
    public static PlatformCommentRulePrivate FromCustom(string value)
    {
        return new PlatformCommentRulePrivate(value);
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

    public static bool operator ==(PlatformCommentRulePrivate value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(PlatformCommentRulePrivate value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(PlatformCommentRulePrivate value) => value.Value;

    public static explicit operator PlatformCommentRulePrivate(string value) => new(value);

    internal class PlatformCommentRulePrivateSerializer : JsonConverter<PlatformCommentRulePrivate>
    {
        public override PlatformCommentRulePrivate Read(
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
            return new PlatformCommentRulePrivate(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            PlatformCommentRulePrivate value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override PlatformCommentRulePrivate ReadAsPropertyName(
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
            return new PlatformCommentRulePrivate(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            PlatformCommentRulePrivate value,
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
        public const string Available = "available";

        public const string NoApi = "noApi";

        public const string Unsupported = "unsupported";
    }
}
