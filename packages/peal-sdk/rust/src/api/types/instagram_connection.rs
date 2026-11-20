pub use crate::prelude::*;

/// How an Instagram channel reaches its account: Instagram Login, a Facebook Page, or Meta's Unified login.
#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum InstagramConnection {
    InstagramLogin,
    FacebookLogin,
    UnifiedLogin,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for InstagramConnection {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::InstagramLogin => serializer.serialize_str("instagramLogin"),
            Self::FacebookLogin => serializer.serialize_str("facebookLogin"),
            Self::UnifiedLogin => serializer.serialize_str("unifiedLogin"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for InstagramConnection {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "instagramLogin" => Ok(Self::InstagramLogin),
            "facebookLogin" => Ok(Self::FacebookLogin),
            "unifiedLogin" => Ok(Self::UnifiedLogin),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for InstagramConnection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InstagramLogin => write!(f, "instagramLogin"),
            Self::FacebookLogin => write!(f, "facebookLogin"),
            Self::UnifiedLogin => write!(f, "unifiedLogin"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
