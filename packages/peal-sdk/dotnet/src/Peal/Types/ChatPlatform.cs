using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(ChatPlatform.ChatPlatformSerializer))]
[Serializable]
public readonly record struct ChatPlatform : IStringEnum
{
    public static readonly ChatPlatform Discord = new(Values.Discord);

    public static readonly ChatPlatform Telegram = new(Values.Telegram);

    public ChatPlatform(string value)
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
    public static ChatPlatform FromCustom(string value)
    {
        return new ChatPlatform(value);
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

    public static bool operator ==(ChatPlatform value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(ChatPlatform value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(ChatPlatform value) => value.Value;

    public static explicit operator ChatPlatform(string value) => new(value);

    internal class ChatPlatformSerializer : JsonConverter<ChatPlatform>
    {
        public override ChatPlatform Read(
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
            return new ChatPlatform(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            ChatPlatform value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override ChatPlatform ReadAsPropertyName(
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
            return new ChatPlatform(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            ChatPlatform value,
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
        public const string Discord = "discord";

        public const string Telegram = "telegram";
    }
}
