pub use crate::prelude::*;

/// What the site makes of a post once it shows it: published, or a draft to finish there.
#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum SiteStatusOption {
    Publish,
    Draft,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for SiteStatusOption {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Publish => serializer.serialize_str("publish"),
            Self::Draft => serializer.serialize_str("draft"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for SiteStatusOption {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "publish" => Ok(Self::Publish),
            "draft" => Ok(Self::Draft),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for SiteStatusOption {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Publish => write!(f, "publish"),
            Self::Draft => write!(f, "draft"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
