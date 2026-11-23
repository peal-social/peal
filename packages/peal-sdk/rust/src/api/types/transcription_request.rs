pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct TranscriptionRequest {
    #[serde(rename = "saveAsDescription")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub save_as_description: Option<bool>,
}

impl TranscriptionRequest {
    pub fn builder() -> TranscriptionRequestBuilder {
        <TranscriptionRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct TranscriptionRequestBuilder {
    save_as_description: Option<bool>,
}

impl TranscriptionRequestBuilder {
    pub fn save_as_description(mut self, value: bool) -> Self {
        self.save_as_description = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`TranscriptionRequest`].
    pub fn build(self) -> Result<TranscriptionRequest, BuildError> {
        Ok(TranscriptionRequest {
            save_as_description: self.save_as_description,
        })
    }
}
