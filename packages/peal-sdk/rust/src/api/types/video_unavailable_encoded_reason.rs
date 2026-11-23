pub use crate::prelude::*;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum VideoUnavailableEncodedReason {
    NotSet,
    KeyUnreadable,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for VideoUnavailableEncodedReason {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::NotSet => serializer.serialize_str("notSet"),
            Self::KeyUnreadable => serializer.serialize_str("keyUnreadable"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for VideoUnavailableEncodedReason {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "notSet" => Ok(Self::NotSet),
            "keyUnreadable" => Ok(Self::KeyUnreadable),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for VideoUnavailableEncodedReason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotSet => write!(f, "notSet"),
            Self::KeyUnreadable => write!(f, "keyUnreadable"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
