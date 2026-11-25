using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(PlatformFollowUpComment.PlatformFollowUpCommentSerializer))]
[Serializable]
public readonly record struct PlatformFollowUpComment : IStringEnum
{
    public static readonly PlatformFollowUpComment Available = new(Values.Available);

    public static readonly PlatformFollowUpComment NoApi = new(Values.NoApi);

    public static readonly PlatformFollowUpComment Review = new(Values.Review);

    public static readonly PlatformFollowUpComment NotBuilt = new(Values.NotBuilt);

    public static readonly PlatformFollowUpComment NotAllowed = new(Values.NotAllowed);

    public static readonly PlatformFollowUpComment TurnedOff = new(Values.TurnedOff);

    public static readonly PlatformFollowUpComment NotCounted = new(Values.NotCounted);

    public PlatformFollowUpComment(string value)
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
    public static PlatformFollowUpComment FromCustom(string value)
    {
        return new PlatformFollowUpComment(value);
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

    public static bool operator ==(PlatformFollowUpComment value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(PlatformFollowUpComment value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(PlatformFollowUpComment value) => value.Value;

    public static explicit operator PlatformFollowUpComment(string value) => new(value);

    internal class PlatformFollowUpCommentSerializer : JsonConverter<PlatformFollowUpComment>
    {
        public override PlatformFollowUpComment Read(
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
            return new PlatformFollowUpComment(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            PlatformFollowUpComment value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override PlatformFollowUpComment ReadAsPropertyName(
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
            return new PlatformFollowUpComment(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            PlatformFollowUpComment value,
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

        public const string Review = "review";

        public const string NotBuilt = "notBuilt";

        public const string NotAllowed = "notAllowed";

        public const string TurnedOff = "turnedOff";

        public const string NotCounted = "notCounted";
    }
}
