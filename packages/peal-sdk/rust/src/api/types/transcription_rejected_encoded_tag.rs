pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum TranscriptionRejectedEncodedTag {
    TranscriptionRejected,
}
impl fmt::Display for TranscriptionRejectedEncodedTag {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::TranscriptionRejected => "TranscriptionRejected",
        };
        write!(f, "{}", s)
    }
}
