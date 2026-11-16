pub use crate::prelude::*;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum ChatNotConnectedReason {
    AddressNotAWebhook,
    WebhookNotFound,
    WebhookKindNotSupported,
    CredentialsRefused,
    ChatNotFound,
    ChatKindNotSupported,
    CannotPost,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for ChatNotConnectedReason {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::AddressNotAWebhook => serializer.serialize_str("addressNotAWebhook"),
            Self::WebhookNotFound => serializer.serialize_str("webhookNotFound"),
            Self::WebhookKindNotSupported => serializer.serialize_str("webhookKindNotSupported"),
            Self::CredentialsRefused => serializer.serialize_str("credentialsRefused"),
            Self::ChatNotFound => serializer.serialize_str("chatNotFound"),
            Self::ChatKindNotSupported => serializer.serialize_str("chatKindNotSupported"),
            Self::CannotPost => serializer.serialize_str("cannotPost"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for ChatNotConnectedReason {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "addressNotAWebhook" => Ok(Self::AddressNotAWebhook),
            "webhookNotFound" => Ok(Self::WebhookNotFound),
            "webhookKindNotSupported" => Ok(Self::WebhookKindNotSupported),
            "credentialsRefused" => Ok(Self::CredentialsRefused),
            "chatNotFound" => Ok(Self::ChatNotFound),
            "chatKindNotSupported" => Ok(Self::ChatKindNotSupported),
            "cannotPost" => Ok(Self::CannotPost),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for ChatNotConnectedReason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::AddressNotAWebhook => write!(f, "addressNotAWebhook"),
            Self::WebhookNotFound => write!(f, "webhookNotFound"),
            Self::WebhookKindNotSupported => write!(f, "webhookKindNotSupported"),
            Self::CredentialsRefused => write!(f, "credentialsRefused"),
            Self::ChatNotFound => write!(f, "chatNotFound"),
            Self::ChatKindNotSupported => write!(f, "chatKindNotSupported"),
            Self::CannotPost => write!(f, "cannotPost"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
