pub use crate::prelude::*;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum BrowserAnalyticsConsent {
    Undecided,
    Granted,
    Refused,
    /// This variant is used for forward compatibility.
    /// If the server sends a value not recognized by the current SDK version,
    /// it will be captured here with the raw string value.
    __Unknown(String),
}
impl Serialize for BrowserAnalyticsConsent {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Undecided => serializer.serialize_str("undecided"),
            Self::Granted => serializer.serialize_str("granted"),
            Self::Refused => serializer.serialize_str("refused"),
            Self::__Unknown(val) => serializer.serialize_str(val),
        }
    }
}

impl<'de> Deserialize<'de> for BrowserAnalyticsConsent {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "undecided" => Ok(Self::Undecided),
            "granted" => Ok(Self::Granted),
            "refused" => Ok(Self::Refused),
            _ => Ok(Self::__Unknown(value)),
        }
    }
}

impl fmt::Display for BrowserAnalyticsConsent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Undecided => write!(f, "undecided"),
            Self::Granted => write!(f, "granted"),
            Self::Refused => write!(f, "refused"),
            Self::__Unknown(val) => write!(f, "{}", val),
        }
    }
}
