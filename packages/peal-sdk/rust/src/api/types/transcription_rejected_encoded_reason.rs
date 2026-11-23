pub use crate::prelude::*;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum TranscriptionRejectedEncodedReason {
    NotAudio,
    NotReady,
    TooLarge,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for TranscriptionRejectedEncodedReason {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::NotAudio => serializer.serialize_str("notAudio"),
            Self::NotReady => serializer.serialize_str("notReady"),
            Self::TooLarge => serializer.serialize_str("tooLarge"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for TranscriptionRejectedEncodedReason {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "notAudio" => Ok(Self::NotAudio),
            "notReady" => Ok(Self::NotReady),
            "tooLarge" => Ok(Self::TooLarge),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for TranscriptionRejectedEncodedReason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotAudio => write!(f, "notAudio"),
            Self::NotReady => write!(f, "notReady"),
            Self::TooLarge => write!(f, "tooLarge"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
