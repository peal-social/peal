using global::System.Text.Json;
using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal;

[JsonConverter(
    typeof(ArticleViolationSiteStatusNotTakenStatus.ArticleViolationSiteStatusNotTakenStatusSerializer)
)]
[Serializable]
public readonly record struct ArticleViolationSiteStatusNotTakenStatus : IStringEnum
{
    public static readonly ArticleViolationSiteStatusNotTakenStatus Publish = new(Values.Publish);

    public static readonly ArticleViolationSiteStatusNotTakenStatus Draft = new(Values.Draft);

    public static readonly ArticleViolationSiteStatusNotTakenStatus Future = new(Values.Future);

    public ArticleViolationSiteStatusNotTakenStatus(string value)
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
    public static ArticleViolationSiteStatusNotTakenStatus FromCustom(string value)
    {
        return new ArticleViolationSiteStatusNotTakenStatus(value);
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

    public static bool operator ==(
        ArticleViolationSiteStatusNotTakenStatus value1,
        string value2
    ) => value1.Value.Equals(value2);

    public static bool operator !=(
        ArticleViolationSiteStatusNotTakenStatus value1,
        string value2
    ) => !value1.Value.Equals(value2);

    public static explicit operator string(ArticleViolationSiteStatusNotTakenStatus value) =>
        value.Value;

    public static explicit operator ArticleViolationSiteStatusNotTakenStatus(string value) =>
        new(value);

    internal class ArticleViolationSiteStatusNotTakenStatusSerializer
        : JsonConverter<ArticleViolationSiteStatusNotTakenStatus>
    {
        public override ArticleViolationSiteStatusNotTakenStatus Read(
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
            return new ArticleViolationSiteStatusNotTakenStatus(stringValue);
        }

        public override void Write(
            Utf8JsonWriter writer,
            ArticleViolationSiteStatusNotTakenStatus value,
            JsonSerializerOptions options
        )
        {
            writer.WriteStringValue(value.Value);
        }

        public override ArticleViolationSiteStatusNotTakenStatus ReadAsPropertyName(
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
            return new ArticleViolationSiteStatusNotTakenStatus(stringValue);
        }

        public override void WriteAsPropertyName(
            Utf8JsonWriter writer,
            ArticleViolationSiteStatusNotTakenStatus value,
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
        public const string Publish = "publish";

        public const string Draft = "draft";

        public const string Future = "future";
    }
}
