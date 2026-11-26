using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(PostExternalIdTakenEncodedTag.PostExternalIdTakenEncodedTagSerializer))]
[Serializable]
public readonly record struct PostExternalIdTakenEncodedTag : IStringEnum
{
    public static readonly PostExternalIdTakenEncodedTag PostExternalIdTaken = new(
        Values.PostExternalIdTaken
    );

    public PostExternalIdTakenEncodedTag(string value)
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
    public static PostExternalIdTakenEncodedTag FromCustom(string value)
    {
        return new PostExternalIdTakenEncodedTag(value);
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

    public static bool operator ==(PostExternalIdTakenEncodedTag value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(PostExternalIdTakenEncodedTag value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(PostExternalIdTakenEncodedTag value) => value.Value;

    public static explicit operator PostExternalIdTakenEncodedTag(string value) => new(value);

    internal class PostExternalIdTakenEncodedTagSerializer
        : JsonConverter<PostExternalIdTakenEncodedTag>
    {
        public override PostExternalIdTakenEncodedTag Read(
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
            return new PostExternalIdTakenEncodedTag(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            PostExternalIdTakenEncodedTag value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override PostExternalIdTakenEncodedTag ReadAsPropertyName(
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
            return new PostExternalIdTakenEncodedTag(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            PostExternalIdTakenEncodedTag value,
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
        public const string PostExternalIdTaken = "PostExternalIdTaken";
    }
}
