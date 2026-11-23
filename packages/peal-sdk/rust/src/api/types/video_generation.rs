pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct VideoGeneration {
    pub aspect: ImageAspect,
    #[serde(rename = "createdAt")]
    #[serde(default)]
    pub created_at: String,
    #[serde(rename = "durationSeconds")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_seconds: Option<i64>,
    #[serde(rename = "finishedAt")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<String>,
    #[serde(default)]
    pub id: String,
    #[serde(rename = "imageMediaId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_media_id: Option<String>,
    #[serde(rename = "mediaId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<VideoFailureReason>,
    #[serde(rename = "startedAt")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    pub status: VideoGenerationStatus,
}

impl VideoGeneration {
    pub fn builder() -> VideoGenerationBuilder {
        <VideoGenerationBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct VideoGenerationBuilder {
    aspect: Option<ImageAspect>,
    created_at: Option<String>,
    duration_seconds: Option<i64>,
    finished_at: Option<String>,
    id: Option<String>,
    image_media_id: Option<String>,
    media_id: Option<String>,
    reason: Option<VideoFailureReason>,
    started_at: Option<String>,
    status: Option<VideoGenerationStatus>,
}

impl VideoGenerationBuilder {
    pub fn aspect(mut self, value: ImageAspect) -> Self {
        self.aspect = Some(value);
        self
    }

    pub fn created_at(mut self, value: impl Into<String>) -> Self {
        self.created_at = Some(value.into());
        self
    }

    pub fn duration_seconds(mut self, value: i64) -> Self {
        self.duration_seconds = Some(value);
        self
    }

    pub fn finished_at(mut self, value: impl Into<String>) -> Self {
        self.finished_at = Some(value.into());
        self
    }

    pub fn id(mut self, value: impl Into<String>) -> Self {
        self.id = Some(value.into());
        self
    }

    pub fn image_media_id(mut self, value: impl Into<String>) -> Self {
        self.image_media_id = Some(value.into());
        self
    }

    pub fn media_id(mut self, value: impl Into<String>) -> Self {
        self.media_id = Some(value.into());
        self
    }

    pub fn reason(mut self, value: VideoFailureReason) -> Self {
        self.reason = Some(value);
        self
    }

    pub fn started_at(mut self, value: impl Into<String>) -> Self {
        self.started_at = Some(value.into());
        self
    }

    pub fn status(mut self, value: VideoGenerationStatus) -> Self {
        self.status = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`VideoGeneration`].
    /// This method will fail if any of the following fields are not set:
    /// - [`aspect`](VideoGenerationBuilder::aspect)
    /// - [`created_at`](VideoGenerationBuilder::created_at)
    /// - [`id`](VideoGenerationBuilder::id)
    /// - [`status`](VideoGenerationBuilder::status)
    pub fn build(self) -> Result<VideoGeneration, BuildError> {
        Ok(VideoGeneration {
            aspect: self
                .aspect
                .ok_or_else(|| BuildError::missing_field("aspect"))?,
            created_at: self
                .created_at
                .ok_or_else(|| BuildError::missing_field("created_at"))?,
            duration_seconds: self.duration_seconds,
            finished_at: self.finished_at,
            id: self.id.ok_or_else(|| BuildError::missing_field("id"))?,
            image_media_id: self.image_media_id,
            media_id: self.media_id,
            reason: self.reason,
            started_at: self.started_at,
            status: self
                .status
                .ok_or_else(|| BuildError::missing_field("status"))?,
        })
    }
}
