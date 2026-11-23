pub use crate::prelude::*;

/// Query parameters for list
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct SlideshowsListQueryRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<SlideshowStatus>,
}

impl SlideshowsListQueryRequest {
    pub fn builder() -> SlideshowsListQueryRequestBuilder {
        <SlideshowsListQueryRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct SlideshowsListQueryRequestBuilder {
    status: Option<SlideshowStatus>,
}

impl SlideshowsListQueryRequestBuilder {
    pub fn status(mut self, value: SlideshowStatus) -> Self {
        self.status = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`SlideshowsListQueryRequest`].
    pub fn build(self) -> Result<SlideshowsListQueryRequest, BuildError> {
        Ok(SlideshowsListQueryRequest {
            status: self.status,
        })
    }
}
