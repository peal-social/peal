pub use crate::prelude::*;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum PrivateReplyRefusal {
    OwnComment,
    Gone,
    TooOld,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for PrivateReplyRefusal {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::OwnComment => serializer.serialize_str("ownComment"),
            Self::Gone => serializer.serialize_str("gone"),
            Self::TooOld => serializer.serialize_str("tooOld"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for PrivateReplyRefusal {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "ownComment" => Ok(Self::OwnComment),
            "gone" => Ok(Self::Gone),
            "tooOld" => Ok(Self::TooOld),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for PrivateReplyRefusal {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::OwnComment => write!(f, "ownComment"),
            Self::Gone => write!(f, "gone"),
            Self::TooOld => write!(f, "tooOld"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
