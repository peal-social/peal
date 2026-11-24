pub use crate::prelude::*;

/// Query parameters for list
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct MeNoticesListQueryRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<String>,
}

impl MeNoticesListQueryRequest {
    pub fn builder() -> MeNoticesListQueryRequestBuilder {
        <MeNoticesListQueryRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct MeNoticesListQueryRequestBuilder {
    cursor: Option<String>,
    limit: Option<String>,
}

impl MeNoticesListQueryRequestBuilder {
    pub fn cursor(mut self, value: impl Into<String>) -> Self {
        self.cursor = Some(value.into());
        self
    }

    pub fn limit(mut self, value: impl Into<String>) -> Self {
        self.limit = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`MeNoticesListQueryRequest`].
    pub fn build(self) -> Result<MeNoticesListQueryRequest, BuildError> {
        Ok(MeNoticesListQueryRequest {
            cursor: self.cursor,
            limit: self.limit,
        })
    }
}
