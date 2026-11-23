pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct VideoGenerationRequest {
    pub aspect: ImageAspect,
    #[serde(rename = "durationSeconds")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_seconds: Option<i64>,
    #[serde(rename = "imageMediaId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_media_id: Option<String>,
    #[serde(default)]
    pub prompt: String,
}

impl VideoGenerationRequest {
    pub fn builder() -> VideoGenerationRequestBuilder {
        <VideoGenerationRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct VideoGenerationRequestBuilder {
    aspect: Option<ImageAspect>,
    duration_seconds: Option<i64>,
    image_media_id: Option<String>,
    prompt: Option<String>,
}

impl VideoGenerationRequestBuilder {
    pub fn aspect(mut self, value: ImageAspect) -> Self {
        self.aspect = Some(value);
        self
    }

    pub fn duration_seconds(mut self, value: i64) -> Self {
        self.duration_seconds = Some(value);
        self
    }

    pub fn image_media_id(mut self, value: impl Into<String>) -> Self {
        self.image_media_id = Some(value.into());
        self
    }

    pub fn prompt(mut self, value: impl Into<String>) -> Self {
        self.prompt = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`VideoGenerationRequest`].
    /// This method will fail if any of the following fields are not set:
    /// - [`aspect`](VideoGenerationRequestBuilder::aspect)
    /// - [`prompt`](VideoGenerationRequestBuilder::prompt)
    pub fn build(self) -> Result<VideoGenerationRequest, BuildError> {
        Ok(VideoGenerationRequest {
            aspect: self
                .aspect
                .ok_or_else(|| BuildError::missing_field("aspect"))?,
            duration_seconds: self.duration_seconds,
            image_media_id: self.image_media_id,
            prompt: self
                .prompt
                .ok_or_else(|| BuildError::missing_field("prompt"))?,
        })
    }
}
