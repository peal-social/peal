pub use crate::prelude::*;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum AiImageProvider {
    Openai,
    Google,
    Xai,
    Togetherai,
    OpenaiCompatible,
    Fal,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for AiImageProvider {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Openai => serializer.serialize_str("openai"),
            Self::Google => serializer.serialize_str("google"),
            Self::Xai => serializer.serialize_str("xai"),
            Self::Togetherai => serializer.serialize_str("togetherai"),
            Self::OpenaiCompatible => serializer.serialize_str("openai-compatible"),
            Self::Fal => serializer.serialize_str("fal"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for AiImageProvider {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "openai" => Ok(Self::Openai),
            "google" => Ok(Self::Google),
            "xai" => Ok(Self::Xai),
            "togetherai" => Ok(Self::Togetherai),
            "openai-compatible" => Ok(Self::OpenaiCompatible),
            "fal" => Ok(Self::Fal),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for AiImageProvider {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Openai => write!(f, "openai"),
            Self::Google => write!(f, "google"),
            Self::Xai => write!(f, "xai"),
            Self::Togetherai => write!(f, "togetherai"),
            Self::OpenaiCompatible => write!(f, "openai-compatible"),
            Self::Fal => write!(f, "fal"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
