using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Inbox;

[JsonConverter(
    typeof(ListConversationsMessagesRequestUnread.ListConversationsMessagesRequestUnreadSerializer)
)]
[Serializable]
public readonly record struct ListConversationsMessagesRequestUnread : IStringEnum
{
    public static readonly ListConversationsMessagesRequestUnread True = new(Values.True);

    public static readonly ListConversationsMessagesRequestUnread False = new(Values.False);

    public ListConversationsMessagesRequestUnread(string value)
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
    public static ListConversationsMessagesRequestUnread FromCustom(string value)
    {
        return new ListConversationsMessagesRequestUnread(value);
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

    public static bool operator ==(ListConversationsMessagesRequestUnread value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(ListConversationsMessagesRequestUnread value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(ListConversationsMessagesRequestUnread value) =>
        value.Value;

    public static explicit operator ListConversationsMessagesRequestUnread(string value) =>
        new(value);

    internal class ListConversationsMessagesRequestUnreadSerializer
        : JsonConverter<ListConversationsMessagesRequestUnread>
    {
        public override ListConversationsMessagesRequestUnread Read(
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
            return new ListConversationsMessagesRequestUnread(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            ListConversationsMessagesRequestUnread value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override ListConversationsMessagesRequestUnread ReadAsPropertyName(
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
            return new ListConversationsMessagesRequestUnread(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            ListConversationsMessagesRequestUnread value,
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
        public const string True = "true";

        public const string False = "false";
    }
}
