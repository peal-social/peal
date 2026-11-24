pub use crate::prelude::*;

/// Query parameters for list
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct MediaSlideshowsListQueryRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<SlideshowStatus>,
}

impl MediaSlideshowsListQueryRequest {
    pub fn builder() -> MediaSlideshowsListQueryRequestBuilder {
        <MediaSlideshowsListQueryRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct MediaSlideshowsListQueryRequestBuilder {
    status: Option<SlideshowStatus>,
}

impl MediaSlideshowsListQueryRequestBuilder {
    pub fn status(mut self, value: SlideshowStatus) -> Self {
        self.status = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`MediaSlideshowsListQueryRequest`].
    pub fn build(self) -> Result<MediaSlideshowsListQueryRequest, BuildError> {
        Ok(MediaSlideshowsListQueryRequest {
            status: self.status,
        })
    }
}
