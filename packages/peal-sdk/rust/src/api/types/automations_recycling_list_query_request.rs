pub use crate::prelude::*;

/// Query parameters for list
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct AutomationsRecyclingListQueryRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<RecyclingStatus>,
}

impl AutomationsRecyclingListQueryRequest {
    pub fn builder() -> AutomationsRecyclingListQueryRequestBuilder {
        <AutomationsRecyclingListQueryRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct AutomationsRecyclingListQueryRequestBuilder {
    cursor: Option<String>,
    limit: Option<String>,
    status: Option<RecyclingStatus>,
}

impl AutomationsRecyclingListQueryRequestBuilder {
    pub fn cursor(mut self, value: impl Into<String>) -> Self {
        self.cursor = Some(value.into());
        self
    }

    pub fn limit(mut self, value: impl Into<String>) -> Self {
        self.limit = Some(value.into());
        self
    }

    pub fn status(mut self, value: RecyclingStatus) -> Self {
        self.status = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`AutomationsRecyclingListQueryRequest`].
    pub fn build(self) -> Result<AutomationsRecyclingListQueryRequest, BuildError> {
        Ok(AutomationsRecyclingListQueryRequest {
            cursor: self.cursor,
            limit: self.limit,
            status: self.status,
        })
    }
}
