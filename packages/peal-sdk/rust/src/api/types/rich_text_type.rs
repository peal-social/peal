pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum RichTextType {
    #[serde(rename = "doc")]
    Doc,
}
impl fmt::Display for RichTextType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Doc => "doc",
        };
        write!(f, "{}", s)
    }
}
