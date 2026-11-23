pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct VoiceoverRequest {
    #[serde(default)]
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice: Option<String>,
}

impl VoiceoverRequest {
    pub fn builder() -> VoiceoverRequestBuilder {
        <VoiceoverRequestBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct VoiceoverRequestBuilder {
    text: Option<String>,
    voice: Option<String>,
}

impl VoiceoverRequestBuilder {
    pub fn text(mut self, value: impl Into<String>) -> Self {
        self.text = Some(value.into());
        self
    }

    pub fn voice(mut self, value: impl Into<String>) -> Self {
        self.voice = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`VoiceoverRequest`].
    /// This method will fail if any of the following fields are not set:
    /// - [`text`](VoiceoverRequestBuilder::text)
    pub fn build(self) -> Result<VoiceoverRequest, BuildError> {
        Ok(VoiceoverRequest {
            text: self.text.ok_or_else(|| BuildError::missing_field("text"))?,
            voice: self.voice,
        })
    }
}
