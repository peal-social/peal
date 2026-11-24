pub use crate::prelude::*;

/// Query parameters for list
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct WorkspaceActivityListQueryRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operation: Option<String>,
}

impl WorkspaceActivityListQueryRequest {
    pub fn builder() -> WorkspaceActivityListQueryRequestBuilder {
        <WorkspaceActivityListQueryRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct WorkspaceActivityListQueryRequestBuilder {
    actor: Option<String>,
    cursor: Option<String>,
    limit: Option<String>,
    operation: Option<String>,
}

impl WorkspaceActivityListQueryRequestBuilder {
    pub fn actor(mut self, value: impl Into<String>) -> Self {
        self.actor = Some(value.into());
        self
    }

    pub fn cursor(mut self, value: impl Into<String>) -> Self {
        self.cursor = Some(value.into());
        self
    }

    pub fn limit(mut self, value: impl Into<String>) -> Self {
        self.limit = Some(value.into());
        self
    }

    pub fn operation(mut self, value: impl Into<String>) -> Self {
        self.operation = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`WorkspaceActivityListQueryRequest`].
    pub fn build(self) -> Result<WorkspaceActivityListQueryRequest, BuildError> {
        Ok(WorkspaceActivityListQueryRequest {
            actor: self.actor,
            cursor: self.cursor,
            limit: self.limit,
            operation: self.operation,
        })
    }
}
