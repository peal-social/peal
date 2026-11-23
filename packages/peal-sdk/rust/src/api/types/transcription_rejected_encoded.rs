pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct TranscriptionRejectedEncoded {
    #[serde(rename = "_tag")]
    pub tag: TranscriptionRejectedEncodedTag,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(rename = "requestId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(rename = "maxBytes")]
    #[serde(default)]
    pub max_bytes: i64,
    pub reason: TranscriptionRejectedEncodedReason,
}

impl TranscriptionRejectedEncoded {
    pub fn builder() -> TranscriptionRejectedEncodedBuilder {
        <TranscriptionRejectedEncodedBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct TranscriptionRejectedEncodedBuilder {
    tag: Option<TranscriptionRejectedEncodedTag>,
    code: Option<String>,
    message: Option<String>,
    request_id: Option<String>,
    max_bytes: Option<i64>,
    reason: Option<TranscriptionRejectedEncodedReason>,
}

impl TranscriptionRejectedEncodedBuilder {
    pub fn tag(mut self, value: TranscriptionRejectedEncodedTag) -> Self {
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

    pub fn max_bytes(mut self, value: i64) -> Self {
        self.max_bytes = Some(value);
        self
    }

    pub fn reason(mut self, value: TranscriptionRejectedEncodedReason) -> Self {
        self.reason = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`TranscriptionRejectedEncoded`].
    /// This method will fail if any of the following fields are not set:
    /// - [`tag`](TranscriptionRejectedEncodedBuilder::tag)
    /// - [`max_bytes`](TranscriptionRejectedEncodedBuilder::max_bytes)
    /// - [`reason`](TranscriptionRejectedEncodedBuilder::reason)
    pub fn build(self) -> Result<TranscriptionRejectedEncoded, BuildError> {
        Ok(TranscriptionRejectedEncoded {
            tag: self.tag.ok_or_else(|| BuildError::missing_field("tag"))?,
            code: self.code,
            message: self.message,
            request_id: self.request_id,
            max_bytes: self
                .max_bytes
                .ok_or_else(|| BuildError::missing_field("max_bytes"))?,
            reason: self
                .reason
                .ok_or_else(|| BuildError::missing_field("reason"))?,
        })
    }
}
