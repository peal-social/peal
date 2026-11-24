pub use crate::prelude::*;

/// Query parameters for get
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct WorkspaceUsageGetQueryRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from: Option<CalendarDay>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to: Option<CalendarDay>,
}

impl WorkspaceUsageGetQueryRequest {
    pub fn builder() -> WorkspaceUsageGetQueryRequestBuilder {
        <WorkspaceUsageGetQueryRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct WorkspaceUsageGetQueryRequestBuilder {
    from: Option<CalendarDay>,
    to: Option<CalendarDay>,
}

impl WorkspaceUsageGetQueryRequestBuilder {
    pub fn from(mut self, value: CalendarDay) -> Self {
        self.from = Some(value);
        self
    }

    pub fn to(mut self, value: CalendarDay) -> Self {
        self.to = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`WorkspaceUsageGetQueryRequest`].
    pub fn build(self) -> Result<WorkspaceUsageGetQueryRequest, BuildError> {
        Ok(WorkspaceUsageGetQueryRequest {
            from: self.from,
            to: self.to,
        })
    }
}
