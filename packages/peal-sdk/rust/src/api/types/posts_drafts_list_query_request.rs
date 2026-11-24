pub use crate::prelude::*;

/// Query parameters for list
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct PostsDraftsListQueryRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<String>,
}

impl PostsDraftsListQueryRequest {
    pub fn builder() -> PostsDraftsListQueryRequestBuilder {
        <PostsDraftsListQueryRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct PostsDraftsListQueryRequestBuilder {
    cursor: Option<String>,
    limit: Option<String>,
}

impl PostsDraftsListQueryRequestBuilder {
    pub fn cursor(mut self, value: impl Into<String>) -> Self {
        self.cursor = Some(value.into());
        self
    }

    pub fn limit(mut self, value: impl Into<String>) -> Self {
        self.limit = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`PostsDraftsListQueryRequest`].
    pub fn build(self) -> Result<PostsDraftsListQueryRequest, BuildError> {
        Ok(PostsDraftsListQueryRequest {
            cursor: self.cursor,
            limit: self.limit,
        })
    }
}
