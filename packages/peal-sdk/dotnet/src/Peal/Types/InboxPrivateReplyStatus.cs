using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(InboxPrivateReplyStatus.InboxPrivateReplyStatusSerializer))]
[Serializable]
public readonly record struct InboxPrivateReplyStatus : IStringEnum
{
    public static readonly InboxPrivateReplyStatus Sending = new(Values.Sending);

    public static readonly InboxPrivateReplyStatus Sent = new(Values.Sent);

    public static readonly InboxPrivateReplyStatus Failed = new(Values.Failed);

    public static readonly InboxPrivateReplyStatus Unconfirmed = new(Values.Unconfirmed);

    public InboxPrivateReplyStatus(string value)
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
    public static InboxPrivateReplyStatus FromCustom(string value)
    {
        return new InboxPrivateReplyStatus(value);
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

    public static bool operator ==(InboxPrivateReplyStatus value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(InboxPrivateReplyStatus value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(InboxPrivateReplyStatus value) => value.Value;

    public static explicit operator InboxPrivateReplyStatus(string value) => new(value);

    internal class InboxPrivateReplyStatusSerializer : JsonConverter<InboxPrivateReplyStatus>
    {
        public override InboxPrivateReplyStatus Read(
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
            return new InboxPrivateReplyStatus(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            InboxPrivateReplyStatus value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override InboxPrivateReplyStatus ReadAsPropertyName(
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
            return new InboxPrivateReplyStatus(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            InboxPrivateReplyStatus value,
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
