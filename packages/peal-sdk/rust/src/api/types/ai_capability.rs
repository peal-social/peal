pub use crate::prelude::*;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum AiCapability {
    Text,
    Image,
    Video,
    Speech,
    Transcription,
    Composition,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for AiCapability {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Text => serializer.serialize_str("text"),
            Self::Image => serializer.serialize_str("image"),
            Self::Video => serializer.serialize_str("video"),
            Self::Speech => serializer.serialize_str("speech"),
            Self::Transcription => serializer.serialize_str("transcription"),
            Self::Composition => serializer.serialize_str("composition"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for AiCapability {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "text" => Ok(Self::Text),
            "image" => Ok(Self::Image),
            "video" => Ok(Self::Video),
            "speech" => Ok(Self::Speech),
            "transcription" => Ok(Self::Transcription),
            "composition" => Ok(Self::Composition),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for AiCapability {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Text => write!(f, "text"),
            Self::Image => write!(f, "image"),
            Self::Video => write!(f, "video"),
            Self::Speech => write!(f, "speech"),
            Self::Transcription => write!(f, "transcription"),
            Self::Composition => write!(f, "composition"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
