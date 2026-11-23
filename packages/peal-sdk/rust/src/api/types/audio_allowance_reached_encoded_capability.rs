pub use crate::prelude::*;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum AudioAllowanceReachedEncodedCapability {
    Speech,
    Transcription,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for AudioAllowanceReachedEncodedCapability {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Speech => serializer.serialize_str("speech"),
            Self::Transcription => serializer.serialize_str("transcription"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for AudioAllowanceReachedEncodedCapability {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "speech" => Ok(Self::Speech),
            "transcription" => Ok(Self::Transcription),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for AudioAllowanceReachedEncodedCapability {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Speech => write!(f, "speech"),
            Self::Transcription => write!(f, "transcription"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
