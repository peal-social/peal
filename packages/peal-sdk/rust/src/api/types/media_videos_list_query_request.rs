pub use crate::prelude::*;

/// Query parameters for list
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct MediaVideosListQueryRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<VideoGenerationStatus>,
}

impl MediaVideosListQueryRequest {
    pub fn builder() -> MediaVideosListQueryRequestBuilder {
        <MediaVideosListQueryRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct MediaVideosListQueryRequestBuilder {
    status: Option<VideoGenerationStatus>,
}

impl MediaVideosListQueryRequestBuilder {
    pub fn status(mut self, value: VideoGenerationStatus) -> Self {
        self.status = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`MediaVideosListQueryRequest`].
    pub fn build(self) -> Result<MediaVideosListQueryRequest, BuildError> {
        Ok(MediaVideosListQueryRequest {
            status: self.status,
        })
    }
}
