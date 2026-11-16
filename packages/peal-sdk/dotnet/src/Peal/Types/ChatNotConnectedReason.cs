using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(ChatNotConnectedReason.ChatNotConnectedReasonSerializer))]
[Serializable]
public readonly record struct ChatNotConnectedReason : IStringEnum
{
    public static readonly ChatNotConnectedReason AddressNotAWebhook = new(
        Values.AddressNotAWebhook
    );

    public static readonly ChatNotConnectedReason WebhookNotFound = new(Values.WebhookNotFound);

    public static readonly ChatNotConnectedReason WebhookKindNotSupported = new(
        Values.WebhookKindNotSupported
    );

    public static readonly ChatNotConnectedReason CredentialsRefused = new(
        Values.CredentialsRefused
    );

    public static readonly ChatNotConnectedReason ChatNotFound = new(Values.ChatNotFound);

    public static readonly ChatNotConnectedReason ChatKindNotSupported = new(
        Values.ChatKindNotSupported
    );

    public static readonly ChatNotConnectedReason CannotPost = new(Values.CannotPost);

    public ChatNotConnectedReason(string value)
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
    public static ChatNotConnectedReason FromCustom(string value)
    {
        return new ChatNotConnectedReason(value);
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

    public static bool operator ==(ChatNotConnectedReason value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(ChatNotConnectedReason value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(ChatNotConnectedReason value) => value.Value;

    public static explicit operator ChatNotConnectedReason(string value) => new(value);

    internal class ChatNotConnectedReasonSerializer : JsonConverter<ChatNotConnectedReason>
    {
        public override ChatNotConnectedReason Read(
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
            return new ChatNotConnectedReason(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            ChatNotConnectedReason value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override ChatNotConnectedReason ReadAsPropertyName(
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
            return new ChatNotConnectedReason(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            ChatNotConnectedReason value,
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
        public const string AddressNotAWebhook = "addressNotAWebhook";

        public const string WebhookNotFound = "webhookNotFound";

        public const string WebhookKindNotSupported = "webhookKindNotSupported";

        public const string CredentialsRefused = "credentialsRefused";

        public const string ChatNotFound = "chatNotFound";

        public const string ChatKindNotSupported = "chatKindNotSupported";

        public const string CannotPost = "cannotPost";
    }
}
