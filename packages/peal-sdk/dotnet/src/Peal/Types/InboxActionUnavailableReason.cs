using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(InboxActionUnavailableReason.InboxActionUnavailableReasonSerializer))]
[Serializable]
public readonly record struct InboxActionUnavailableReason : IStringEnum
{
    public static readonly InboxActionUnavailableReason WindowClosed = new(Values.WindowClosed);

    public InboxActionUnavailableReason(string value)
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
    public static InboxActionUnavailableReason FromCustom(string value)
    {
        return new InboxActionUnavailableReason(value);
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

    public static bool operator ==(InboxActionUnavailableReason value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(InboxActionUnavailableReason value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(InboxActionUnavailableReason value) => value.Value;

    public static explicit operator InboxActionUnavailableReason(string value) => new(value);

    internal class InboxActionUnavailableReasonSerializer
        : JsonConverter<InboxActionUnavailableReason>
    {
        public override InboxActionUnavailableReason Read(
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
            return new InboxActionUnavailableReason(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            InboxActionUnavailableReason value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override InboxActionUnavailableReason ReadAsPropertyName(
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
            return new InboxActionUnavailableReason(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            InboxActionUnavailableReason value,
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
        public const string WindowClosed = "windowClosed";
    }
}
