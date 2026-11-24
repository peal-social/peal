using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Inbox;

[JsonConverter(
    typeof(ListThreadsCommentsRequestUnanswered.ListThreadsCommentsRequestUnansweredSerializer)
)]
[Serializable]
public readonly record struct ListThreadsCommentsRequestUnanswered : IStringEnum
{
    public static readonly ListThreadsCommentsRequestUnanswered True = new(Values.True);

    public static readonly ListThreadsCommentsRequestUnanswered False = new(Values.False);

    public ListThreadsCommentsRequestUnanswered(string value)
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
    public static ListThreadsCommentsRequestUnanswered FromCustom(string value)
    {
        return new ListThreadsCommentsRequestUnanswered(value);
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

    public static bool operator ==(ListThreadsCommentsRequestUnanswered value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(ListThreadsCommentsRequestUnanswered value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(ListThreadsCommentsRequestUnanswered value) =>
        value.Value;

    public static explicit operator ListThreadsCommentsRequestUnanswered(string value) =>
        new(value);

    internal class ListThreadsCommentsRequestUnansweredSerializer
        : JsonConverter<ListThreadsCommentsRequestUnanswered>
    {
        public override ListThreadsCommentsRequestUnanswered Read(
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
            return new ListThreadsCommentsRequestUnanswered(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            ListThreadsCommentsRequestUnanswered value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override ListThreadsCommentsRequestUnanswered ReadAsPropertyName(
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
            return new ListThreadsCommentsRequestUnanswered(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            ListThreadsCommentsRequestUnanswered value,
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
