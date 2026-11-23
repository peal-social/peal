using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(AiProvider.AiProviderSerializer))]
[Serializable]
public readonly record struct AiProvider : IStringEnum
{
    public static readonly AiProvider Anthropic = new(Values.Anthropic);

    public static readonly AiProvider Openai = new(Values.Openai);

    public static readonly AiProvider Google = new(Values.Google);

    public static readonly AiProvider Mistral = new(Values.Mistral);

    public static readonly AiProvider Xai = new(Values.Xai);

    public static readonly AiProvider Groq = new(Values.Groq);

    public static readonly AiProvider Togetherai = new(Values.Togetherai);

    public static readonly AiProvider Deepseek = new(Values.Deepseek);

    public static readonly AiProvider Openrouter = new(Values.Openrouter);

    public static readonly AiProvider Cerebras = new(Values.Cerebras);

    public static readonly AiProvider Fireworks = new(Values.Fireworks);

    public static readonly AiProvider OpenaiCompatible = new(Values.OpenaiCompatible);

    public static readonly AiProvider Elevenlabs = new(Values.Elevenlabs);

    public static readonly AiProvider Fal = new(Values.Fal);

    public static readonly AiProvider Shotstack = new(Values.Shotstack);

    public AiProvider(string value)
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
    public static AiProvider FromCustom(string value)
    {
        return new AiProvider(value);
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

    public static bool operator ==(AiProvider value1, string value2) => value1.Value.Equals(value2);

    public static bool operator !=(AiProvider value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(AiProvider value) => value.Value;

    public static explicit operator AiProvider(string value) => new(value);

    internal class AiProviderSerializer : JsonConverter<AiProvider>
    {
        public override AiProvider Read(
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
            return new AiProvider(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            AiProvider value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override AiProvider ReadAsPropertyName(
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
            return new AiProvider(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            AiProvider value,
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
        public const string Anthropic = "anthropic";

        public const string Openai = "openai";

        public const string Google = "google";

        public const string Mistral = "mistral";

        public const string Xai = "xai";

        public const string Groq = "groq";

        public const string Togetherai = "togetherai";

        public const string Deepseek = "deepseek";

        public const string Openrouter = "openrouter";

        public const string Cerebras = "cerebras";

        public const string Fireworks = "fireworks";

        public const string OpenaiCompatible = "openai-compatible";

        public const string Elevenlabs = "elevenlabs";

        public const string Fal = "fal";

        public const string Shotstack = "shotstack";
    }
}
