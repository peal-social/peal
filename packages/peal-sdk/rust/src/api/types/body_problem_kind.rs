pub use crate::prelude::*;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum BodyProblemKind {
    HeadingLevel,
    Html,
    Table,
    Footnote,
    FrontMatter,
    Image,
    Link,
    TooLarge,
    NotTaken,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for BodyProblemKind {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::HeadingLevel => serializer.serialize_str("headingLevel"),
            Self::Html => serializer.serialize_str("html"),
            Self::Table => serializer.serialize_str("table"),
            Self::Footnote => serializer.serialize_str("footnote"),
            Self::FrontMatter => serializer.serialize_str("frontMatter"),
            Self::Image => serializer.serialize_str("image"),
            Self::Link => serializer.serialize_str("link"),
            Self::TooLarge => serializer.serialize_str("tooLarge"),
            Self::NotTaken => serializer.serialize_str("notTaken"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for BodyProblemKind {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "headingLevel" => Ok(Self::HeadingLevel),
            "html" => Ok(Self::Html),
            "table" => Ok(Self::Table),
            "footnote" => Ok(Self::Footnote),
            "frontMatter" => Ok(Self::FrontMatter),
            "image" => Ok(Self::Image),
            "link" => Ok(Self::Link),
            "tooLarge" => Ok(Self::TooLarge),
            "notTaken" => Ok(Self::NotTaken),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for BodyProblemKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::HeadingLevel => write!(f, "headingLevel"),
            Self::Html => write!(f, "html"),
            Self::Table => write!(f, "table"),
            Self::Footnote => write!(f, "footnote"),
            Self::FrontMatter => write!(f, "frontMatter"),
            Self::Image => write!(f, "image"),
            Self::Link => write!(f, "link"),
            Self::TooLarge => write!(f, "tooLarge"),
            Self::NotTaken => write!(f, "notTaken"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
