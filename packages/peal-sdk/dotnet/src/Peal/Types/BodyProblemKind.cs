using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(typeof(BodyProblemKind.BodyProblemKindSerializer))]
[Serializable]
public readonly record struct BodyProblemKind : IStringEnum
{
    public static readonly BodyProblemKind HeadingLevel = new(Values.HeadingLevel);

    public static readonly BodyProblemKind Html = new(Values.Html);

    public static readonly BodyProblemKind Table = new(Values.Table);

    public static readonly BodyProblemKind Footnote = new(Values.Footnote);

    public static readonly BodyProblemKind FrontMatter = new(Values.FrontMatter);

    public static readonly BodyProblemKind Image = new(Values.Image);

    public static readonly BodyProblemKind Link = new(Values.Link);

    public static readonly BodyProblemKind TooLarge = new(Values.TooLarge);

    public static readonly BodyProblemKind NotTaken = new(Values.NotTaken);

    public BodyProblemKind(string value)
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
    public static BodyProblemKind FromCustom(string value)
    {
        return new BodyProblemKind(value);
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

    public static bool operator ==(BodyProblemKind value1, string value2) =>
        value1.Value.Equals(value2);

    public static bool operator !=(BodyProblemKind value1, string value2) =>
        !value1.Value.Equals(value2);

    public static explicit operator string(BodyProblemKind value) => value.Value;

    public static explicit operator BodyProblemKind(string value) => new(value);

    internal class BodyProblemKindSerializer : JsonConverter<BodyProblemKind>
    {
        public override BodyProblemKind Read(
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
            return new BodyProblemKind(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            BodyProblemKind value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override BodyProblemKind ReadAsPropertyName(
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
            return new BodyProblemKind(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            BodyProblemKind value,
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
        public const string HeadingLevel = "headingLevel";

        public const string Html = "html";

        public const string Table = "table";

        public const string Footnote = "footnote";

        public const string FrontMatter = "frontMatter";

        public const string Image = "image";

        public const string Link = "link";

        public const string TooLarge = "tooLarge";

        public const string NotTaken = "notTaken";
    }
}
