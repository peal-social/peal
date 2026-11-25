using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(PlatformFollowUpRepost.PlatformFollowUpRepostSerializer))]
[Serializable]
public readonly record struct PlatformFollowUpRepost : IStringEnum
{
    public static readonly PlatformFollowUpRepost Available = new(Values.Available);

    public static readonly PlatformFollowUpRepost NoApi = new(Values.NoApi);

    public static readonly PlatformFollowUpRepost NotBuilt = new(Values.NotBuilt);

    public static readonly PlatformFollowUpRepost NotAllowed = new(Values.NotAllowed);

    public static readonly PlatformFollowUpRepost NotCounted = new(Values.NotCounted);

    public PlatformFollowUpRepost(string value)
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
    public static PlatformFollowUpRepost FromCustom(string value)
    {
        return new PlatformFollowUpRepost(value);
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

    public static bool operator ==(PlatformFollowUpRepost value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(PlatformFollowUpRepost value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(PlatformFollowUpRepost value) => value.Value;

    public static explicit operator PlatformFollowUpRepost(string value) => new(value);

    internal class PlatformFollowUpRepostSerializer : JsonConverter<PlatformFollowUpRepost>
    {
        public override PlatformFollowUpRepost Read(
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
            return new PlatformFollowUpRepost(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            PlatformFollowUpRepost value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override PlatformFollowUpRepost ReadAsPropertyName(
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
            return new PlatformFollowUpRepost(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            PlatformFollowUpRepost value,
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

        public const string NotBuilt = "notBuilt";

        public const string NotAllowed = "notAllowed";

        public const string NotCounted = "notCounted";
    }
}
