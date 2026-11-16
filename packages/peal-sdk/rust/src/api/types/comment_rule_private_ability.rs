pub use crate::prelude::*;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum CommentRulePrivateAbility {
    Available,
    NoApi,
    Unsupported,
    MessagesOff,
    Reconnect,
    TextTooLong,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for CommentRulePrivateAbility {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Available => serializer.serialize_str("available"),
            Self::NoApi => serializer.serialize_str("noApi"),
            Self::Unsupported => serializer.serialize_str("unsupported"),
            Self::MessagesOff => serializer.serialize_str("messagesOff"),
            Self::Reconnect => serializer.serialize_str("reconnect"),
            Self::TextTooLong => serializer.serialize_str("textTooLong"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for CommentRulePrivateAbility {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "available" => Ok(Self::Available),
            "noApi" => Ok(Self::NoApi),
            "unsupported" => Ok(Self::Unsupported),
            "messagesOff" => Ok(Self::MessagesOff),
            "reconnect" => Ok(Self::Reconnect),
            "textTooLong" => Ok(Self::TextTooLong),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for CommentRulePrivateAbility {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Available => write!(f, "available"),
            Self::NoApi => write!(f, "noApi"),
            Self::Unsupported => write!(f, "unsupported"),
            Self::MessagesOff => write!(f, "messagesOff"),
            Self::Reconnect => write!(f, "reconnect"),
            Self::TextTooLong => write!(f, "textTooLong"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
