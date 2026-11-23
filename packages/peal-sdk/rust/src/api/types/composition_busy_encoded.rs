pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct CompositionBusyEncoded {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(rename = "requestId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(rename = "slideshowId")]
    #[serde(default)]
    pub slideshow_id: String,
}

impl CompositionBusyEncoded {
    pub fn builder() -> CompositionBusyEncodedBuilder {
        <CompositionBusyEncodedBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct CompositionBusyEncodedBuilder {
    code: Option<String>,
    message: Option<String>,
    request_id: Option<String>,
    slideshow_id: Option<String>,
}

impl CompositionBusyEncodedBuilder {
    pub fn code(mut self, value: impl Into<String>) -> Self {
        self.code = Some(value.into());
        self
    }

    pub fn message(mut self, value: impl Into<String>) -> Self {
        self.message = Some(value.into());
        self
    }

    pub fn request_id(mut self, value: impl Into<String>) -> Self {
        self.request_id = Some(value.into());
        self
    }

    pub fn slideshow_id(mut self, value: impl Into<String>) -> Self {
        self.slideshow_id = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`CompositionBusyEncoded`].
    /// This method will fail if any of the following fields are not set:
    /// - [`slideshow_id`](CompositionBusyEncodedBuilder::slideshow_id)
    pub fn build(self) -> Result<CompositionBusyEncoded, BuildError> {
        Ok(CompositionBusyEncoded {
            code: self.code,
            message: self.message,
            request_id: self.request_id,
            slideshow_id: self
                .slideshow_id
                .ok_or_else(|| BuildError::missing_field("slideshow_id"))?,
        })
    }
}
