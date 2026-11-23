using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(
    typeof(VideoRequestRejectedEncodedReason.VideoRequestRejectedEncodedReasonSerializer)
)]
[Serializable]
public readonly record struct VideoRequestRejectedEncodedReason : IStringEnum
{
    public static readonly VideoRequestRejectedEncodedReason AspectNotOffered = new(
        Values.AspectNotOffered
    );

    public static readonly VideoRequestRejectedEncodedReason DurationNotOffered = new(
        Values.DurationNotOffered
    );

    public static readonly VideoRequestRejectedEncodedReason ImageNotOffered = new(
        Values.ImageNotOffered
    );

    public static readonly VideoRequestRejectedEncodedReason ImageNotFound = new(
        Values.ImageNotFound
    );

    public VideoRequestRejectedEncodedReason(string value)
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
    public static VideoRequestRejectedEncodedReason FromCustom(string value)
    {
        return new VideoRequestRejectedEncodedReason(value);
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

    public static bool operator ==(VideoRequestRejectedEncodedReason value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(VideoRequestRejectedEncodedReason value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(VideoRequestRejectedEncodedReason value) => value.Value;

    public static explicit operator VideoRequestRejectedEncodedReason(string value) => new(value);

    internal class VideoRequestRejectedEncodedReasonSerializer
        : JsonConverter<VideoRequestRejectedEncodedReason>
    {
        public override VideoRequestRejectedEncodedReason Read(
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
            return new VideoRequestRejectedEncodedReason(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            VideoRequestRejectedEncodedReason value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override VideoRequestRejectedEncodedReason ReadAsPropertyName(
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
            return new VideoRequestRejectedEncodedReason(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            VideoRequestRejectedEncodedReason value,
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
        public const string AspectNotOffered = "aspectNotOffered";

        public const string DurationNotOffered = "durationNotOffered";

        public const string ImageNotOffered = "imageNotOffered";

        public const string ImageNotFound = "imageNotFound";
    }
}
