pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Slideshow {
    pub aspect: ImageAspect,
    #[serde(rename = "createdAt")]
    #[serde(default)]
    pub created_at: String,
    #[serde(rename = "durationSeconds")]
    pub duration_seconds: SlideshowDurationSeconds,
    #[serde(rename = "finishedAt")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<String>,
    #[serde(default)]
    pub id: String,
    #[serde(rename = "imageMediaIds")]
    #[serde(default)]
    pub image_media_ids: Vec<String>,
    #[serde(rename = "mediaId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<SlideshowFailureReason>,
    #[serde(default)]
    pub sandbox: bool,
    #[serde(rename = "startedAt")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    pub status: SlideshowStatus,
    #[serde(rename = "voiceoverMediaId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voiceover_media_id: Option<String>,
}

impl Slideshow {
    pub fn builder() -> SlideshowBuilder {
        <SlideshowBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct SlideshowBuilder {
    aspect: Option<ImageAspect>,
    created_at: Option<String>,
    duration_seconds: Option<SlideshowDurationSeconds>,
    finished_at: Option<String>,
    id: Option<String>,
    image_media_ids: Option<Vec<String>>,
    media_id: Option<String>,
    reason: Option<SlideshowFailureReason>,
    sandbox: Option<bool>,
    started_at: Option<String>,
    status: Option<SlideshowStatus>,
    voiceover_media_id: Option<String>,
}

impl SlideshowBuilder {
    pub fn aspect(mut self, value: ImageAspect) -> Self {
        self.aspect = Some(value);
        self
    }

    pub fn created_at(mut self, value: impl Into<String>) -> Self {
        self.created_at = Some(value.into());
        self
    }

    pub fn duration_seconds(mut self, value: SlideshowDurationSeconds) -> Self {
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

    pub fn image_media_ids(mut self, value: Vec<String>) -> Self {
        self.image_media_ids = Some(value);
        self
    }

    pub fn media_id(mut self, value: impl Into<String>) -> Self {
        self.media_id = Some(value.into());
        self
    }

    pub fn reason(mut self, value: SlideshowFailureReason) -> Self {
        self.reason = Some(value);
        self
    }

    pub fn sandbox(mut self, value: bool) -> Self {
        self.sandbox = Some(value);
        self
    }

    pub fn started_at(mut self, value: impl Into<String>) -> Self {
        self.started_at = Some(value.into());
        self
    }

    pub fn status(mut self, value: SlideshowStatus) -> Self {
        self.status = Some(value);
        self
    }

    pub fn voiceover_media_id(mut self, value: impl Into<String>) -> Self {
        self.voiceover_media_id = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`Slideshow`].
    /// This method will fail if any of the following fields are not set:
    /// - [`aspect`](SlideshowBuilder::aspect)
    /// - [`created_at`](SlideshowBuilder::created_at)
    /// - [`duration_seconds`](SlideshowBuilder::duration_seconds)
    /// - [`id`](SlideshowBuilder::id)
    /// - [`image_media_ids`](SlideshowBuilder::image_media_ids)
    /// - [`sandbox`](SlideshowBuilder::sandbox)
    /// - [`status`](SlideshowBuilder::status)
    pub fn build(self) -> Result<Slideshow, BuildError> {
        Ok(Slideshow {
            aspect: self
                .aspect
                .ok_or_else(|| BuildError::missing_field("aspect"))?,
            created_at: self
                .created_at
                .ok_or_else(|| BuildError::missing_field("created_at"))?,
            duration_seconds: self
                .duration_seconds
                .ok_or_else(|| BuildError::missing_field("duration_seconds"))?,
            finished_at: self.finished_at,
            id: self.id.ok_or_else(|| BuildError::missing_field("id"))?,
            image_media_ids: self
                .image_media_ids
                .ok_or_else(|| BuildError::missing_field("image_media_ids"))?,
            media_id: self.media_id,
            reason: self.reason,
            sandbox: self
                .sandbox
                .ok_or_else(|| BuildError::missing_field("sandbox"))?,
            started_at: self.started_at,
            status: self
                .status
                .ok_or_else(|| BuildError::missing_field("status"))?,
            voiceover_media_id: self.voiceover_media_id,
        })
    }
}
