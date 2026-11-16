using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(CommentRulePrivateStatus.CommentRulePrivateStatusSerializer))]
[Serializable]
public readonly record struct CommentRulePrivateStatus : IStringEnum
{
    public static readonly CommentRulePrivateStatus Sending = new(Values.Sending);

    public static readonly CommentRulePrivateStatus Sent = new(Values.Sent);

    public static readonly CommentRulePrivateStatus Failed = new(Values.Failed);

    public static readonly CommentRulePrivateStatus Unconfirmed = new(Values.Unconfirmed);

    public CommentRulePrivateStatus(string value)
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
    public static CommentRulePrivateStatus FromCustom(string value)
    {
        return new CommentRulePrivateStatus(value);
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

    public static bool operator ==(CommentRulePrivateStatus value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(CommentRulePrivateStatus value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(CommentRulePrivateStatus value) => value.Value;

    public static explicit operator CommentRulePrivateStatus(string value) => new(value);

    internal class CommentRulePrivateStatusSerializer : JsonConverter<CommentRulePrivateStatus>
    {
        public override CommentRulePrivateStatus Read(
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
            return new CommentRulePrivateStatus(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            CommentRulePrivateStatus value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override CommentRulePrivateStatus ReadAsPropertyName(
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
            return new CommentRulePrivateStatus(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            CommentRulePrivateStatus value,
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
        public const string Sending = "sending";

        public const string Sent = "sent";

        public const string Failed = "failed";

        public const string Unconfirmed = "unconfirmed";
    }
}
