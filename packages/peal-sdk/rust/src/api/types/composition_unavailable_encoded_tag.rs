pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum CompositionUnavailableEncodedTag {
    CompositionUnavailable,
}
impl fmt::Display for CompositionUnavailableEncodedTag {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::CompositionUnavailable => "CompositionUnavailable",
        };
        write!(f, "{}", s)
    }
}
