pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct VideoBusyEncoded {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(rename = "requestId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(rename = "generationId")]
    #[serde(default)]
    pub generation_id: String,
}

impl VideoBusyEncoded {
    pub fn builder() -> VideoBusyEncodedBuilder {
        <VideoBusyEncodedBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct VideoBusyEncodedBuilder {
    code: Option<String>,
    message: Option<String>,
    request_id: Option<String>,
    generation_id: Option<String>,
}

impl VideoBusyEncodedBuilder {
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

    pub fn generation_id(mut self, value: impl Into<String>) -> Self {
        self.generation_id = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`VideoBusyEncoded`].
    /// This method will fail if any of the following fields are not set:
    /// - [`generation_id`](VideoBusyEncodedBuilder::generation_id)
    pub fn build(self) -> Result<VideoBusyEncoded, BuildError> {
        Ok(VideoBusyEncoded {
            code: self.code,
            message: self.message,
            request_id: self.request_id,
            generation_id: self
                .generation_id
                .ok_or_else(|| BuildError::missing_field("generation_id"))?,
        })
    }
}
