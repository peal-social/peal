pub use crate::prelude::*;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum SlideshowRejection {
    ImageNotFound,
    ImageNotSupported,
    VoiceoverNotFound,
    TooLong,
    VoiceoverTooLong,
    VoiceoverTooShort,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for SlideshowRejection {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::ImageNotFound => serializer.serialize_str("imageNotFound"),
            Self::ImageNotSupported => serializer.serialize_str("imageNotSupported"),
            Self::VoiceoverNotFound => serializer.serialize_str("voiceoverNotFound"),
            Self::TooLong => serializer.serialize_str("tooLong"),
            Self::VoiceoverTooLong => serializer.serialize_str("voiceoverTooLong"),
            Self::VoiceoverTooShort => serializer.serialize_str("voiceoverTooShort"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for SlideshowRejection {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "imageNotFound" => Ok(Self::ImageNotFound),
            "imageNotSupported" => Ok(Self::ImageNotSupported),
            "voiceoverNotFound" => Ok(Self::VoiceoverNotFound),
            "tooLong" => Ok(Self::TooLong),
            "voiceoverTooLong" => Ok(Self::VoiceoverTooLong),
            "voiceoverTooShort" => Ok(Self::VoiceoverTooShort),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for SlideshowRejection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ImageNotFound => write!(f, "imageNotFound"),
            Self::ImageNotSupported => write!(f, "imageNotSupported"),
            Self::VoiceoverNotFound => write!(f, "voiceoverNotFound"),
            Self::TooLong => write!(f, "tooLong"),
            Self::VoiceoverTooLong => write!(f, "voiceoverTooLong"),
            Self::VoiceoverTooShort => write!(f, "voiceoverTooShort"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
