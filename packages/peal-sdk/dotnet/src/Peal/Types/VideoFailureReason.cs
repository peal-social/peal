using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(VideoFailureReason.VideoFailureReasonSerializer))]
[Serializable]
public readonly record struct VideoFailureReason : IStringEnum
{
    public static readonly VideoFailureReason Unavailable = new(Values.Unavailable);

    public static readonly VideoFailureReason KeyUnreadable = new(Values.KeyUnreadable);

    public static readonly VideoFailureReason SettingsRefused = new(Values.SettingsRefused);

    public static readonly VideoFailureReason AddressRefused = new(Values.AddressRefused);

    public static readonly VideoFailureReason Redirected = new(Values.Redirected);

    public static readonly VideoFailureReason Unreachable = new(Values.Unreachable);

    public static readonly VideoFailureReason Refused = new(Values.Refused);

    public static readonly VideoFailureReason TimedOut = new(Values.TimedOut);

    public static readonly VideoFailureReason UnusableAnswer = new(Values.UnusableAnswer);

    public static readonly VideoFailureReason ImageUnavailable = new(Values.ImageUnavailable);

    public static readonly VideoFailureReason StorageFull = new(Values.StorageFull);

    public static readonly VideoFailureReason NotStored = new(Values.NotStored);

    public static readonly VideoFailureReason Interrupted = new(Values.Interrupted);

    public VideoFailureReason(string value)
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
    public static VideoFailureReason FromCustom(string value)
    {
        return new VideoFailureReason(value);
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

    public static bool operator ==(VideoFailureReason value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(VideoFailureReason value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(VideoFailureReason value) => value.Value;

    public static explicit operator VideoFailureReason(string value) => new(value);

    internal class VideoFailureReasonSerializer : JsonConverter<VideoFailureReason>
    {
        public override VideoFailureReason Read(
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
            return new VideoFailureReason(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            VideoFailureReason value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override VideoFailureReason ReadAsPropertyName(
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
            return new VideoFailureReason(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            VideoFailureReason value,
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

        public const string ImageUnavailable = "imageUnavailable";

        public const string StorageFull = "storageFull";

        public const string NotStored = "notStored";

        public const string Interrupted = "interrupted";
    }
}
