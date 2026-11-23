pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum AudioProviderFailedEncodedTag {
    AudioProviderFailed,
}
impl fmt::Display for AudioProviderFailedEncodedTag {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::AudioProviderFailed => "AudioProviderFailed",
        };
        write!(f, "{}", s)
    }
}
