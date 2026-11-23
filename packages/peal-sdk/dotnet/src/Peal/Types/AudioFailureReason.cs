using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(AudioFailureReason.AudioFailureReasonSerializer))]
[Serializable]
public readonly record struct AudioFailureReason : IStringEnum
{
    public static readonly AudioFailureReason SettingsRefused = new(Values.SettingsRefused);

    public static readonly AudioFailureReason AddressRefused = new(Values.AddressRefused);

    public static readonly AudioFailureReason Redirected = new(Values.Redirected);

    public static readonly AudioFailureReason Unreachable = new(Values.Unreachable);

    public static readonly AudioFailureReason Refused = new(Values.Refused);

    public static readonly AudioFailureReason TimedOut = new(Values.TimedOut);

    public static readonly AudioFailureReason UnusableAnswer = new(Values.UnusableAnswer);

    public AudioFailureReason(string value)
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
    public static AudioFailureReason FromCustom(string value)
    {
        return new AudioFailureReason(value);
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

    public static bool operator ==(AudioFailureReason value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(AudioFailureReason value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(AudioFailureReason value) => value.Value;

    public static explicit operator AudioFailureReason(string value) => new(value);

    internal class AudioFailureReasonSerializer : JsonConverter<AudioFailureReason>
    {
        public override AudioFailureReason Read(
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
            return new AudioFailureReason(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            AudioFailureReason value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override AudioFailureReason ReadAsPropertyName(
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
            return new AudioFailureReason(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            AudioFailureReason value,
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
        public const string SettingsRefused = "settingsRefused";

        public const string AddressRefused = "addressRefused";

        public const string Redirected = "redirected";

        public const string Unreachable = "unreachable";

        public const string Refused = "refused";

        public const string TimedOut = "timedOut";

        public const string UnusableAnswer = "unusableAnswer";
    }
}
