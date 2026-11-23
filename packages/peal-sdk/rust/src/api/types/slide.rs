pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct Slide {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(rename = "mediaId")]
    #[serde(default)]
    pub media_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub motion: Option<SlideMotion>,
}

impl Slide {
    pub fn builder() -> SlideBuilder {
        <SlideBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct SlideBuilder {
    caption: Option<String>,
    media_id: Option<String>,
    motion: Option<SlideMotion>,
}

impl SlideBuilder {
    pub fn caption(mut self, value: impl Into<String>) -> Self {
        self.caption = Some(value.into());
        self
    }

    pub fn media_id(mut self, value: impl Into<String>) -> Self {
        self.media_id = Some(value.into());
        self
    }

    pub fn motion(mut self, value: SlideMotion) -> Self {
        self.motion = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`Slide`].
    /// This method will fail if any of the following fields are not set:
    /// - [`media_id`](SlideBuilder::media_id)
    pub fn build(self) -> Result<Slide, BuildError> {
        Ok(Slide {
            caption: self.caption,
            media_id: self
                .media_id
                .ok_or_else(|| BuildError::missing_field("media_id"))?,
            motion: self.motion,
        })
    }
}
