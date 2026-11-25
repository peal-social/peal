pub use crate::prelude::*;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum PlatformFollowUpComment {
    Available,
    NoApi,
    Review,
    NotBuilt,
    NotAllowed,
    TurnedOff,
    NotCounted,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for PlatformFollowUpComment {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Available => serializer.serialize_str("available"),
            Self::NoApi => serializer.serialize_str("noApi"),
            Self::Review => serializer.serialize_str("review"),
            Self::NotBuilt => serializer.serialize_str("notBuilt"),
            Self::NotAllowed => serializer.serialize_str("notAllowed"),
            Self::TurnedOff => serializer.serialize_str("turnedOff"),
            Self::NotCounted => serializer.serialize_str("notCounted"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for PlatformFollowUpComment {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "available" => Ok(Self::Available),
            "noApi" => Ok(Self::NoApi),
            "review" => Ok(Self::Review),
            "notBuilt" => Ok(Self::NotBuilt),
            "notAllowed" => Ok(Self::NotAllowed),
            "turnedOff" => Ok(Self::TurnedOff),
            "notCounted" => Ok(Self::NotCounted),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for PlatformFollowUpComment {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Available => write!(f, "available"),
            Self::NoApi => write!(f, "noApi"),
            Self::Review => write!(f, "review"),
            Self::NotBuilt => write!(f, "notBuilt"),
            Self::NotAllowed => write!(f, "notAllowed"),
            Self::TurnedOff => write!(f, "turnedOff"),
            Self::NotCounted => write!(f, "notCounted"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
