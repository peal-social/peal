using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(InboxPrivateReplyReason.InboxPrivateReplyReasonSerializer))]
[Serializable]
public readonly record struct InboxPrivateReplyReason : IStringEnum
{
    public static readonly InboxPrivateReplyReason ChannelUnavailable = new(
        Values.ChannelUnavailable
    );

    public static readonly InboxPrivateReplyReason ReconnectNeeded = new(Values.ReconnectNeeded);

    public static readonly InboxPrivateReplyReason RateLimited = new(Values.RateLimited);

    public static readonly InboxPrivateReplyReason PlatformUnavailable = new(
        Values.PlatformUnavailable
    );

    public static readonly InboxPrivateReplyReason CommentGone = new(Values.CommentGone);

    public static readonly InboxPrivateReplyReason AlreadyAnswered = new(Values.AlreadyAnswered);

    public static readonly InboxPrivateReplyReason Refused = new(Values.Refused);

    public static readonly InboxPrivateReplyReason WindowClosed = new(Values.WindowClosed);

    public static readonly InboxPrivateReplyReason NotSent = new(Values.NotSent);

    public static readonly InboxPrivateReplyReason NoResponse = new(Values.NoResponse);

    public static readonly InboxPrivateReplyReason Interrupted = new(Values.Interrupted);

    public static readonly InboxPrivateReplyReason AdapterFailure = new(Values.AdapterFailure);

    public InboxPrivateReplyReason(string value)
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
    public static InboxPrivateReplyReason FromCustom(string value)
    {
        return new InboxPrivateReplyReason(value);
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

    public static bool operator ==(InboxPrivateReplyReason value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(InboxPrivateReplyReason value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(InboxPrivateReplyReason value) => value.Value;

    public static explicit operator InboxPrivateReplyReason(string value) => new(value);

    internal class InboxPrivateReplyReasonSerializer : JsonConverter<InboxPrivateReplyReason>
    {
        public override InboxPrivateReplyReason Read(
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
            return new InboxPrivateReplyReason(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            InboxPrivateReplyReason value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override InboxPrivateReplyReason ReadAsPropertyName(
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
            return new InboxPrivateReplyReason(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            InboxPrivateReplyReason value,
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
        public const string ChannelUnavailable = "channelUnavailable";

        public const string ReconnectNeeded = "reconnectNeeded";

        public const string RateLimited = "rateLimited";

        public const string PlatformUnavailable = "platformUnavailable";

        public const string CommentGone = "commentGone";

        public const string AlreadyAnswered = "alreadyAnswered";

        public const string Refused = "refused";

        public const string WindowClosed = "windowClosed";

        public const string NotSent = "notSent";

        public const string NoResponse = "noResponse";

        public const string Interrupted = "interrupted";

        public const string AdapterFailure = "adapterFailure";
    }
}
