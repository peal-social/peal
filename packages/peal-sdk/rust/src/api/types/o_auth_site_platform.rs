pub use crate::prelude::*;

/// A kind of website a channel connects to by signing in.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum OAuthSitePlatform {
    #[serde(rename = "wordpressCom")]
    WordpressCom,
}
impl fmt::Display for OAuthSitePlatform {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::WordpressCom => "wordpressCom",
        };
        write!(f, "{}", s)
    }
}
