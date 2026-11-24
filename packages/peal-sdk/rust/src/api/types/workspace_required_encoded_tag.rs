pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum WorkspaceRequiredEncodedTag {
    WorkspaceRequired,
}
impl fmt::Display for WorkspaceRequiredEncodedTag {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::WorkspaceRequired => "WorkspaceRequired",
        };
        write!(f, "{}", s)
    }
}
