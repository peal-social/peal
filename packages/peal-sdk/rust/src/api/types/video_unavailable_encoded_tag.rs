pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum VideoUnavailableEncodedTag {
    VideoUnavailable,
}
impl fmt::Display for VideoUnavailableEncodedTag {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::VideoUnavailable => "VideoUnavailable",
        };
        write!(f, "{}", s)
    }
}
