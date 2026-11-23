pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum AudioUnavailableEncodedTag {
    AudioUnavailable,
}
impl fmt::Display for AudioUnavailableEncodedTag {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::AudioUnavailable => "AudioUnavailable",
        };
        write!(f, "{}", s)
    }
}
