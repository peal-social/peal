using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(PlatformCommentRuleReply.PlatformCommentRuleReplySerializer))]
[Serializable]
public readonly record struct PlatformCommentRuleReply : IStringEnum
{
    public static readonly PlatformCommentRuleReply Available = new(Values.Available);

    public static readonly PlatformCommentRuleReply NoApi = new(Values.NoApi);

    public static readonly PlatformCommentRuleReply NotAllowed = new(Values.NotAllowed);

    public static readonly PlatformCommentRuleReply Unsupported = new(Values.Unsupported);

    public PlatformCommentRuleReply(string value)
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
    public static PlatformCommentRuleReply FromCustom(string value)
    {
        return new PlatformCommentRuleReply(value);
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

    public static bool operator ==(PlatformCommentRuleReply value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(PlatformCommentRuleReply value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(PlatformCommentRuleReply value) => value.Value;

    public static explicit operator PlatformCommentRuleReply(string value) => new(value);

    internal class PlatformCommentRuleReplySerializer : JsonConverter<PlatformCommentRuleReply>
    {
        public override PlatformCommentRuleReply Read(
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
            return new PlatformCommentRuleReply(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            PlatformCommentRuleReply value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override PlatformCommentRuleReply ReadAsPropertyName(
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
            return new PlatformCommentRuleReply(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            PlatformCommentRuleReply value,
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

        public const string NotAllowed = "notAllowed";

        public const string Unsupported = "unsupported";
    }
}
