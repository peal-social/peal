using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(NoticeEventSlideshowEndedOutcome.NoticeEventSlideshowEndedOutcomeSerializer))]
[Serializable]
public readonly record struct NoticeEventSlideshowEndedOutcome : IStringEnum
{
    public static readonly NoticeEventSlideshowEndedOutcome Succeeded = new(Values.Succeeded);

    public static readonly NoticeEventSlideshowEndedOutcome Failed = new(Values.Failed);

    public NoticeEventSlideshowEndedOutcome(string value)
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
    public static NoticeEventSlideshowEndedOutcome FromCustom(string value)
    {
        return new NoticeEventSlideshowEndedOutcome(value);
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

    public static bool operator ==(NoticeEventSlideshowEndedOutcome value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(NoticeEventSlideshowEndedOutcome value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(NoticeEventSlideshowEndedOutcome value) => value.Value;

    public static explicit operator NoticeEventSlideshowEndedOutcome(string value) => new(value);

    internal class NoticeEventSlideshowEndedOutcomeSerializer
        : JsonConverter<NoticeEventSlideshowEndedOutcome>
    {
        public override NoticeEventSlideshowEndedOutcome Read(
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
            return new NoticeEventSlideshowEndedOutcome(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            NoticeEventSlideshowEndedOutcome value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override NoticeEventSlideshowEndedOutcome ReadAsPropertyName(
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
            return new NoticeEventSlideshowEndedOutcome(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            NoticeEventSlideshowEndedOutcome value,
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
        public const string Succeeded = "succeeded";

        public const string Failed = "failed";
    }
}
