pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum InboxActionUnavailableReason {
    #[serde(rename = "windowClosed")]
    WindowClosed,
}
impl fmt::Display for InboxActionUnavailableReason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::WindowClosed => "windowClosed",
        };
        write!(f, "{}", s)
    }
}
