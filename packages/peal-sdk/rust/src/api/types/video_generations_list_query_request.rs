pub use crate::prelude::*;

/// Query parameters for list
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct VideoGenerationsListQueryRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<VideoGenerationStatus>,
}

impl VideoGenerationsListQueryRequest {
    pub fn builder() -> VideoGenerationsListQueryRequestBuilder {
        <VideoGenerationsListQueryRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct VideoGenerationsListQueryRequestBuilder {
    status: Option<VideoGenerationStatus>,
}

impl VideoGenerationsListQueryRequestBuilder {
    pub fn status(mut self, value: VideoGenerationStatus) -> Self {
        self.status = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`VideoGenerationsListQueryRequest`].
    pub fn build(self) -> Result<VideoGenerationsListQueryRequest, BuildError> {
        Ok(VideoGenerationsListQueryRequest {
            status: self.status,
        })
    }
}
