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
    EditInvalid,
    MediaNotFound,
    MediaNotSupported,
    EditTooLong,
    EditTooLarge,
    OutputNotSupported,
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
            Self::EditInvalid => serializer.serialize_str("editInvalid"),
            Self::MediaNotFound => serializer.serialize_str("mediaNotFound"),
            Self::MediaNotSupported => serializer.serialize_str("mediaNotSupported"),
            Self::EditTooLong => serializer.serialize_str("editTooLong"),
            Self::EditTooLarge => serializer.serialize_str("editTooLarge"),
            Self::OutputNotSupported => serializer.serialize_str("outputNotSupported"),
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
            "editInvalid" => Ok(Self::EditInvalid),
            "mediaNotFound" => Ok(Self::MediaNotFound),
            "mediaNotSupported" => Ok(Self::MediaNotSupported),
            "editTooLong" => Ok(Self::EditTooLong),
            "editTooLarge" => Ok(Self::EditTooLarge),
            "outputNotSupported" => Ok(Self::OutputNotSupported),
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
            Self::EditInvalid => write!(f, "editInvalid"),
            Self::MediaNotFound => write!(f, "mediaNotFound"),
            Self::MediaNotSupported => write!(f, "mediaNotSupported"),
            Self::EditTooLong => write!(f, "editTooLong"),
            Self::EditTooLarge => write!(f, "editTooLarge"),
            Self::OutputNotSupported => write!(f, "outputNotSupported"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
