using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Inbox;

[JsonConverter(
    typeof(ListThreadsReviewsRequestUnanswered.ListThreadsReviewsRequestUnansweredSerializer)
)]
[Serializable]
public readonly record struct ListThreadsReviewsRequestUnanswered : IStringEnum
{
    public static readonly ListThreadsReviewsRequestUnanswered True = new(Values.True);

    public static readonly ListThreadsReviewsRequestUnanswered False = new(Values.False);

    public ListThreadsReviewsRequestUnanswered(string value)
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
    public static ListThreadsReviewsRequestUnanswered FromCustom(string value)
    {
        return new ListThreadsReviewsRequestUnanswered(value);
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

    public static bool operator ==(ListThreadsReviewsRequestUnanswered value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(ListThreadsReviewsRequestUnanswered value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(ListThreadsReviewsRequestUnanswered value) =>
        value.Value;

    public static explicit operator ListThreadsReviewsRequestUnanswered(string value) => new(value);

    internal class ListThreadsReviewsRequestUnansweredSerializer
        : JsonConverter<ListThreadsReviewsRequestUnanswered>
    {
        public override ListThreadsReviewsRequestUnanswered Read(
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
            return new ListThreadsReviewsRequestUnanswered(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            ListThreadsReviewsRequestUnanswered value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override ListThreadsReviewsRequestUnanswered ReadAsPropertyName(
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
            return new ListThreadsReviewsRequestUnanswered(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            ListThreadsReviewsRequestUnanswered value,
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
