pub use crate::prelude::*;

/// A kind of website a channel connects to with a key.
#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum KeySitePlatform {
    Devto,
    Hashnode,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for KeySitePlatform {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Devto => serializer.serialize_str("devto"),
            Self::Hashnode => serializer.serialize_str("hashnode"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for KeySitePlatform {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "devto" => Ok(Self::Devto),
            "hashnode" => Ok(Self::Hashnode),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for KeySitePlatform {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Devto => write!(f, "devto"),
            Self::Hashnode => write!(f, "hashnode"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
