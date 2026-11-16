using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(PrivateReplyRefusal.PrivateReplyRefusalSerializer))]
[Serializable]
public readonly record struct PrivateReplyRefusal : IStringEnum
{
    public static readonly PrivateReplyRefusal OwnComment = new(Values.OwnComment);

    public static readonly PrivateReplyRefusal Gone = new(Values.Gone);

    public static readonly PrivateReplyRefusal TooOld = new(Values.TooOld);

    public PrivateReplyRefusal(string value)
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
    public static PrivateReplyRefusal FromCustom(string value)
    {
        return new PrivateReplyRefusal(value);
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

    public static bool operator ==(PrivateReplyRefusal value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(PrivateReplyRefusal value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(PrivateReplyRefusal value) => value.Value;

    public static explicit operator PrivateReplyRefusal(string value) => new(value);

    internal class PrivateReplyRefusalSerializer : JsonConverter<PrivateReplyRefusal>
    {
        public override PrivateReplyRefusal Read(
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
            return new PrivateReplyRefusal(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            PrivateReplyRefusal value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override PrivateReplyRefusal ReadAsPropertyName(
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
            return new PrivateReplyRefusal(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            PrivateReplyRefusal value,
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
        public const string OwnComment = "ownComment";

        public const string Gone = "gone";

        public const string TooOld = "tooOld";
    }
}
