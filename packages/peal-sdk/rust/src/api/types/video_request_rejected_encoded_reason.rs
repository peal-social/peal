pub use crate::prelude::*;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum VideoRequestRejectedEncodedReason {
    AspectNotOffered,
    DurationNotOffered,
    ImageNotOffered,
    ImageNotFound,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for VideoRequestRejectedEncodedReason {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::AspectNotOffered => serializer.serialize_str("aspectNotOffered"),
            Self::DurationNotOffered => serializer.serialize_str("durationNotOffered"),
            Self::ImageNotOffered => serializer.serialize_str("imageNotOffered"),
            Self::ImageNotFound => serializer.serialize_str("imageNotFound"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for VideoRequestRejectedEncodedReason {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "aspectNotOffered" => Ok(Self::AspectNotOffered),
            "durationNotOffered" => Ok(Self::DurationNotOffered),
            "imageNotOffered" => Ok(Self::ImageNotOffered),
            "imageNotFound" => Ok(Self::ImageNotFound),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for VideoRequestRejectedEncodedReason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::AspectNotOffered => write!(f, "aspectNotOffered"),
            Self::DurationNotOffered => write!(f, "durationNotOffered"),
            Self::ImageNotOffered => write!(f, "imageNotOffered"),
            Self::ImageNotFound => write!(f, "imageNotFound"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
