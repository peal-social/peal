using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(AiImageProvider.AiImageProviderSerializer))]
[Serializable]
public readonly record struct AiImageProvider : IStringEnum
{
    public static readonly AiImageProvider Openai = new(Values.Openai);

    public static readonly AiImageProvider Google = new(Values.Google);

    public static readonly AiImageProvider Xai = new(Values.Xai);

    public static readonly AiImageProvider Togetherai = new(Values.Togetherai);

    public static readonly AiImageProvider OpenaiCompatible = new(Values.OpenaiCompatible);

    public static readonly AiImageProvider Fal = new(Values.Fal);

    public AiImageProvider(string value)
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
    public static AiImageProvider FromCustom(string value)
    {
        return new AiImageProvider(value);
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

    public static bool operator ==(AiImageProvider value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(AiImageProvider value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(AiImageProvider value) => value.Value;

    public static explicit operator AiImageProvider(string value) => new(value);

    internal class AiImageProviderSerializer : JsonConverter<AiImageProvider>
    {
        public override AiImageProvider Read(
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
            return new AiImageProvider(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            AiImageProvider value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override AiImageProvider ReadAsPropertyName(
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
            return new AiImageProvider(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            AiImageProvider value,
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
        public const string Openai = "openai";

        public const string Google = "google";

        public const string Xai = "xai";

        public const string Togetherai = "togetherai";

        public const string OpenaiCompatible = "openai-compatible";

        public const string Fal = "fal";
    }
}
