pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct SlideshowRequest {
    pub aspect: ImageAspect,
    #[serde(rename = "secondsPerSlide")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seconds_per_slide: Option<i64>,
    #[serde(default)]
    pub slides: Vec<Slide>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transition: Option<SlideTransition>,
    #[serde(rename = "voiceoverMediaId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voiceover_media_id: Option<String>,
}

impl SlideshowRequest {
    pub fn builder() -> SlideshowRequestBuilder {
        <SlideshowRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct SlideshowRequestBuilder {
    aspect: Option<ImageAspect>,
    seconds_per_slide: Option<i64>,
    slides: Option<Vec<Slide>>,
    transition: Option<SlideTransition>,
    voiceover_media_id: Option<String>,
}

impl SlideshowRequestBuilder {
    pub fn aspect(mut self, value: ImageAspect) -> Self {
        self.aspect = Some(value);
        self
    }

    pub fn seconds_per_slide(mut self, value: i64) -> Self {
        self.seconds_per_slide = Some(value);
        self
    }

    pub fn slides(mut self, value: Vec<Slide>) -> Self {
        self.slides = Some(value);
        self
    }

    pub fn transition(mut self, value: SlideTransition) -> Self {
        self.transition = Some(value);
        self
    }

    pub fn voiceover_media_id(mut self, value: impl Into<String>) -> Self {
        self.voiceover_media_id = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`SlideshowRequest`].
    /// This method will fail if any of the following fields are not set:
    /// - [`aspect`](SlideshowRequestBuilder::aspect)
    /// - [`slides`](SlideshowRequestBuilder::slides)
    pub fn build(self) -> Result<SlideshowRequest, BuildError> {
        Ok(SlideshowRequest {
            aspect: self
                .aspect
                .ok_or_else(|| BuildError::missing_field("aspect"))?,
            seconds_per_slide: self.seconds_per_slide,
            slides: self
                .slides
                .ok_or_else(|| BuildError::missing_field("slides"))?,
            transition: self.transition,
            voiceover_media_id: self.voiceover_media_id,
        })
    }
}
