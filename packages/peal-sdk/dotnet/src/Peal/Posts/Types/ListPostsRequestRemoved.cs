using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(ListPostsRequestRemoved.ListPostsRequestRemovedSerializer))]
[Serializable]
public readonly record struct ListPostsRequestRemoved : IStringEnum
{
    public static readonly ListPostsRequestRemoved True = new(Values.True);

    public static readonly ListPostsRequestRemoved False = new(Values.False);

    public ListPostsRequestRemoved(string value)
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
    public static ListPostsRequestRemoved FromCustom(string value)
    {
        return new ListPostsRequestRemoved(value);
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

    public static bool operator ==(ListPostsRequestRemoved value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(ListPostsRequestRemoved value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(ListPostsRequestRemoved value) => value.Value;

    public static explicit operator ListPostsRequestRemoved(string value) => new(value);

    internal class ListPostsRequestRemovedSerializer : JsonConverter<ListPostsRequestRemoved>
    {
        public override ListPostsRequestRemoved Read(
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
            return new ListPostsRequestRemoved(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            ListPostsRequestRemoved value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override ListPostsRequestRemoved ReadAsPropertyName(
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
            return new ListPostsRequestRemoved(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            ListPostsRequestRemoved value,
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
        public const string True = "true";

        public const string False = "false";
    }
}
