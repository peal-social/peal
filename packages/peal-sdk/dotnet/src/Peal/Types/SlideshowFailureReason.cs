using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(SlideshowFailureReason.SlideshowFailureReasonSerializer))]
[Serializable]
public readonly record struct SlideshowFailureReason : IStringEnum
{
    public static readonly SlideshowFailureReason Unavailable = new(Values.Unavailable);

    public static readonly SlideshowFailureReason KeyUnreadable = new(Values.KeyUnreadable);

    public static readonly SlideshowFailureReason SettingsRefused = new(Values.SettingsRefused);

    public static readonly SlideshowFailureReason AddressRefused = new(Values.AddressRefused);

    public static readonly SlideshowFailureReason Redirected = new(Values.Redirected);

    public static readonly SlideshowFailureReason Unreachable = new(Values.Unreachable);

    public static readonly SlideshowFailureReason Refused = new(Values.Refused);

    public static readonly SlideshowFailureReason TimedOut = new(Values.TimedOut);

    public static readonly SlideshowFailureReason UnusableAnswer = new(Values.UnusableAnswer);

    public static readonly SlideshowFailureReason MediaUnavailable = new(Values.MediaUnavailable);

    public static readonly SlideshowFailureReason StorageFull = new(Values.StorageFull);

    public static readonly SlideshowFailureReason NotStored = new(Values.NotStored);

    public static readonly SlideshowFailureReason Interrupted = new(Values.Interrupted);

    public SlideshowFailureReason(string value)
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
    public static SlideshowFailureReason FromCustom(string value)
    {
        return new SlideshowFailureReason(value);
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

    public static bool operator ==(SlideshowFailureReason value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(SlideshowFailureReason value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(SlideshowFailureReason value) => value.Value;

    public static explicit operator SlideshowFailureReason(string value) => new(value);

    internal class SlideshowFailureReasonSerializer : JsonConverter<SlideshowFailureReason>
    {
        public override SlideshowFailureReason Read(
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
            return new SlideshowFailureReason(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            SlideshowFailureReason value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override SlideshowFailureReason ReadAsPropertyName(
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
            return new SlideshowFailureReason(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            SlideshowFailureReason value,
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
        public const string Unavailable = "unavailable";

        public const string KeyUnreadable = "keyUnreadable";

        public const string SettingsRefused = "settingsRefused";

        public const string AddressRefused = "addressRefused";

        public const string Redirected = "redirected";

        public const string Unreachable = "unreachable";

        public const string Refused = "refused";

        public const string TimedOut = "timedOut";

        public const string UnusableAnswer = "unusableAnswer";

        public const string MediaUnavailable = "mediaUnavailable";

        public const string StorageFull = "storageFull";

        public const string NotStored = "notStored";

        public const string Interrupted = "interrupted";
    }
}
