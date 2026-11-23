pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct AudioUnavailableEncoded {
    #[serde(rename = "_tag")]
    pub tag: AudioUnavailableEncodedTag,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(rename = "requestId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    pub capability: AudioUnavailableEncodedCapability,
    pub reason: AudioUnavailableEncodedReason,
}

impl AudioUnavailableEncoded {
    pub fn builder() -> AudioUnavailableEncodedBuilder {
        <AudioUnavailableEncodedBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct AudioUnavailableEncodedBuilder {
    tag: Option<AudioUnavailableEncodedTag>,
    code: Option<String>,
    message: Option<String>,
    request_id: Option<String>,
    capability: Option<AudioUnavailableEncodedCapability>,
    reason: Option<AudioUnavailableEncodedReason>,
}

impl AudioUnavailableEncodedBuilder {
    pub fn tag(mut self, value: AudioUnavailableEncodedTag) -> Self {
        self.tag = Some(value);
        self
    }

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

    pub fn capability(mut self, value: AudioUnavailableEncodedCapability) -> Self {
        self.capability = Some(value);
        self
    }

    pub fn reason(mut self, value: AudioUnavailableEncodedReason) -> Self {
        self.reason = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`AudioUnavailableEncoded`].
    /// This method will fail if any of the following fields are not set:
    /// - [`tag`](AudioUnavailableEncodedBuilder::tag)
    /// - [`capability`](AudioUnavailableEncodedBuilder::capability)
    /// - [`reason`](AudioUnavailableEncodedBuilder::reason)
    pub fn build(self) -> Result<AudioUnavailableEncoded, BuildError> {
        Ok(AudioUnavailableEncoded {
            tag: self.tag.ok_or_else(|| BuildError::missing_field("tag"))?,
            code: self.code,
            message: self.message,
            request_id: self.request_id,
            capability: self
                .capability
                .ok_or_else(|| BuildError::missing_field("capability"))?,
            reason: self
                .reason
                .ok_or_else(|| BuildError::missing_field("reason"))?,
        })
    }
}
