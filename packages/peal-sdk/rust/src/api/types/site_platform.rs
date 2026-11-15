pub use crate::prelude::*;

/// A kind of website a channel publishes articles to.
#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum SitePlatform {
    Wordpress,
    Devto,
    Hashnode,
    WordpressCom,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for SitePlatform {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Wordpress => serializer.serialize_str("wordpress"),
            Self::Devto => serializer.serialize_str("devto"),
            Self::Hashnode => serializer.serialize_str("hashnode"),
            Self::WordpressCom => serializer.serialize_str("wordpressCom"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for SitePlatform {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "wordpress" => Ok(Self::Wordpress),
            "devto" => Ok(Self::Devto),
            "hashnode" => Ok(Self::Hashnode),
            "wordpressCom" => Ok(Self::WordpressCom),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for SitePlatform {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Wordpress => write!(f, "wordpress"),
            Self::Devto => write!(f, "devto"),
            Self::Hashnode => write!(f, "hashnode"),
            Self::WordpressCom => write!(f, "wordpressCom"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
