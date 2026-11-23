pub use crate::prelude::*;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum SlideMotion {
    None,
    ZoomIn,
    ZoomOut,
    Slide,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for SlideMotion {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::None => serializer.serialize_str("none"),
            Self::ZoomIn => serializer.serialize_str("zoomIn"),
            Self::ZoomOut => serializer.serialize_str("zoomOut"),
            Self::Slide => serializer.serialize_str("slide"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for SlideMotion {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "none" => Ok(Self::None),
            "zoomIn" => Ok(Self::ZoomIn),
            "zoomOut" => Ok(Self::ZoomOut),
            "slide" => Ok(Self::Slide),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for SlideMotion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::None => write!(f, "none"),
            Self::ZoomIn => write!(f, "zoomIn"),
            Self::ZoomOut => write!(f, "zoomOut"),
            Self::Slide => write!(f, "slide"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
