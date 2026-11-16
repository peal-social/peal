using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(CommentRulePrivateAbility.CommentRulePrivateAbilitySerializer))]
[Serializable]
public readonly record struct CommentRulePrivateAbility : IStringEnum
{
    public static readonly CommentRulePrivateAbility Available = new(Values.Available);

    public static readonly CommentRulePrivateAbility NoApi = new(Values.NoApi);

    public static readonly CommentRulePrivateAbility Unsupported = new(Values.Unsupported);

    public static readonly CommentRulePrivateAbility MessagesOff = new(Values.MessagesOff);

    public static readonly CommentRulePrivateAbility Reconnect = new(Values.Reconnect);

    public static readonly CommentRulePrivateAbility TextTooLong = new(Values.TextTooLong);

    public CommentRulePrivateAbility(string value)
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
    public static CommentRulePrivateAbility FromCustom(string value)
    {
        return new CommentRulePrivateAbility(value);
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

    public static bool operator ==(CommentRulePrivateAbility value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(CommentRulePrivateAbility value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(CommentRulePrivateAbility value) => value.Value;

    public static explicit operator CommentRulePrivateAbility(string value) => new(value);

    internal class CommentRulePrivateAbilitySerializer : JsonConverter<CommentRulePrivateAbility>
    {
        public override CommentRulePrivateAbility Read(
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
            return new CommentRulePrivateAbility(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            CommentRulePrivateAbility value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override CommentRulePrivateAbility ReadAsPropertyName(
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
            return new CommentRulePrivateAbility(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            CommentRulePrivateAbility value,
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
        public const string Available = "available";

        public const string NoApi = "noApi";

        public const string Unsupported = "unsupported";

        public const string MessagesOff = "messagesOff";

        public const string Reconnect = "reconnect";

        public const string TextTooLong = "textTooLong";
    }
}
