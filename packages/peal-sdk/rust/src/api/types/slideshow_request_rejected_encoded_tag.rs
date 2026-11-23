pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum SlideshowRequestRejectedEncodedTag {
    SlideshowRequestRejected,
}
impl fmt::Display for SlideshowRequestRejectedEncodedTag {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::SlideshowRequestRejected => "SlideshowRequestRejected",
        };
        write!(f, "{}", s)
    }
}
