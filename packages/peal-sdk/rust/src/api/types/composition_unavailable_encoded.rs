pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct CompositionUnavailableEncoded {
    #[serde(rename = "_tag")]
    pub tag: CompositionUnavailableEncodedTag,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(rename = "requestId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    pub reason: CompositionUnavailableEncodedReason,
}

impl CompositionUnavailableEncoded {
    pub fn builder() -> CompositionUnavailableEncodedBuilder {
        <CompositionUnavailableEncodedBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct CompositionUnavailableEncodedBuilder {
    tag: Option<CompositionUnavailableEncodedTag>,
    code: Option<String>,
    message: Option<String>,
    request_id: Option<String>,
    reason: Option<CompositionUnavailableEncodedReason>,
}

impl CompositionUnavailableEncodedBuilder {
    pub fn tag(mut self, value: CompositionUnavailableEncodedTag) -> Self {
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

    pub fn reason(mut self, value: CompositionUnavailableEncodedReason) -> Self {
        self.reason = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`CompositionUnavailableEncoded`].
    /// This method will fail if any of the following fields are not set:
    /// - [`tag`](CompositionUnavailableEncodedBuilder::tag)
    /// - [`reason`](CompositionUnavailableEncodedBuilder::reason)
    pub fn build(self) -> Result<CompositionUnavailableEncoded, BuildError> {
        Ok(CompositionUnavailableEncoded {
            tag: self.tag.ok_or_else(|| BuildError::missing_field("tag"))?,
            code: self.code,
            message: self.message,
            request_id: self.request_id,
            reason: self
                .reason
                .ok_or_else(|| BuildError::missing_field("reason"))?,
        })
    }
}
