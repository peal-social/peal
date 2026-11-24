pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct WorkspaceSecurity {
    #[serde(rename = "membersWithoutTwoStep")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub members_without_two_step: Option<i64>,
    #[serde(rename = "twoStepRequired")]
    #[serde(default)]
    pub two_step_required: bool,
}

impl WorkspaceSecurity {
    pub fn builder() -> WorkspaceSecurityBuilder {
        <WorkspaceSecurityBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct WorkspaceSecurityBuilder {
    members_without_two_step: Option<i64>,
    two_step_required: Option<bool>,
}

impl WorkspaceSecurityBuilder {
    pub fn members_without_two_step(mut self, value: i64) -> Self {
        self.members_without_two_step = Some(value);
        self
    }

    pub fn two_step_required(mut self, value: bool) -> Self {
        self.two_step_required = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`WorkspaceSecurity`].
    /// This method will fail if any of the following fields are not set:
    /// - [`two_step_required`](WorkspaceSecurityBuilder::two_step_required)
    pub fn build(self) -> Result<WorkspaceSecurity, BuildError> {
        Ok(WorkspaceSecurity {
            members_without_two_step: self.members_without_two_step,
            two_step_required: self
                .two_step_required
                .ok_or_else(|| BuildError::missing_field("two_step_required"))?,
        })
    }
}
