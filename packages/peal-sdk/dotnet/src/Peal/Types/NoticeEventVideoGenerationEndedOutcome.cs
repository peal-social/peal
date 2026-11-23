using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(
    typeof(NoticeEventVideoGenerationEndedOutcome.NoticeEventVideoGenerationEndedOutcomeSerializer)
)]
[Serializable]
public readonly record struct NoticeEventVideoGenerationEndedOutcome : IStringEnum
{
    public static readonly NoticeEventVideoGenerationEndedOutcome Succeeded = new(Values.Succeeded);

    public static readonly NoticeEventVideoGenerationEndedOutcome Failed = new(Values.Failed);

    public NoticeEventVideoGenerationEndedOutcome(string value)
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
    public static NoticeEventVideoGenerationEndedOutcome FromCustom(string value)
    {
        return new NoticeEventVideoGenerationEndedOutcome(value);
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

    public static bool operator ==(NoticeEventVideoGenerationEndedOutcome value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(NoticeEventVideoGenerationEndedOutcome value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(NoticeEventVideoGenerationEndedOutcome value) =>
        value.Value;

    public static explicit operator NoticeEventVideoGenerationEndedOutcome(string value) =>
        new(value);

    internal class NoticeEventVideoGenerationEndedOutcomeSerializer
        : JsonConverter<NoticeEventVideoGenerationEndedOutcome>
    {
        public override NoticeEventVideoGenerationEndedOutcome Read(
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
            return new NoticeEventVideoGenerationEndedOutcome(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            NoticeEventVideoGenerationEndedOutcome value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override NoticeEventVideoGenerationEndedOutcome ReadAsPropertyName(
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
            return new NoticeEventVideoGenerationEndedOutcome(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            NoticeEventVideoGenerationEndedOutcome value,
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
