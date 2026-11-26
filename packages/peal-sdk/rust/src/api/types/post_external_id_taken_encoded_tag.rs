pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum PostExternalIdTakenEncodedTag {
    PostExternalIdTaken,
}
impl fmt::Display for PostExternalIdTakenEncodedTag {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::PostExternalIdTaken => "PostExternalIdTaken",
        };
        write!(f, "{}", s)
    }
}
