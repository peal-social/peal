pub use crate::prelude::*;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum VideoFailureReason {
    Unavailable,
    KeyUnreadable,
    SettingsRefused,
    AddressRefused,
    Redirected,
    Unreachable,
    Refused,
    TimedOut,
    UnusableAnswer,
    ImageUnavailable,
    StorageFull,
    NotStored,
    Interrupted,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for VideoFailureReason {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Unavailable => serializer.serialize_str("unavailable"),
            Self::KeyUnreadable => serializer.serialize_str("keyUnreadable"),
            Self::SettingsRefused => serializer.serialize_str("settingsRefused"),
            Self::AddressRefused => serializer.serialize_str("addressRefused"),
            Self::Redirected => serializer.serialize_str("redirected"),
            Self::Unreachable => serializer.serialize_str("unreachable"),
            Self::Refused => serializer.serialize_str("refused"),
            Self::TimedOut => serializer.serialize_str("timedOut"),
            Self::UnusableAnswer => serializer.serialize_str("unusableAnswer"),
            Self::ImageUnavailable => serializer.serialize_str("imageUnavailable"),
            Self::StorageFull => serializer.serialize_str("storageFull"),
            Self::NotStored => serializer.serialize_str("notStored"),
            Self::Interrupted => serializer.serialize_str("interrupted"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for VideoFailureReason {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "unavailable" => Ok(Self::Unavailable),
            "keyUnreadable" => Ok(Self::KeyUnreadable),
            "settingsRefused" => Ok(Self::SettingsRefused),
            "addressRefused" => Ok(Self::AddressRefused),
            "redirected" => Ok(Self::Redirected),
            "unreachable" => Ok(Self::Unreachable),
            "refused" => Ok(Self::Refused),
            "timedOut" => Ok(Self::TimedOut),
            "unusableAnswer" => Ok(Self::UnusableAnswer),
            "imageUnavailable" => Ok(Self::ImageUnavailable),
            "storageFull" => Ok(Self::StorageFull),
            "notStored" => Ok(Self::NotStored),
            "interrupted" => Ok(Self::Interrupted),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for VideoFailureReason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unavailable => write!(f, "unavailable"),
            Self::KeyUnreadable => write!(f, "keyUnreadable"),
            Self::SettingsRefused => write!(f, "settingsRefused"),
            Self::AddressRefused => write!(f, "addressRefused"),
            Self::Redirected => write!(f, "redirected"),
            Self::Unreachable => write!(f, "unreachable"),
            Self::Refused => write!(f, "refused"),
            Self::TimedOut => write!(f, "timedOut"),
            Self::UnusableAnswer => write!(f, "unusableAnswer"),
            Self::ImageUnavailable => write!(f, "imageUnavailable"),
            Self::StorageFull => write!(f, "storageFull"),
            Self::NotStored => write!(f, "notStored"),
            Self::Interrupted => write!(f, "interrupted"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
