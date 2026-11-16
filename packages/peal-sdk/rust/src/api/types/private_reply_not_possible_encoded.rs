pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct PrivateReplyNotPossibleEncoded {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(rename = "requestId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    pub reason: PrivateReplyRefusal,
}

impl PrivateReplyNotPossibleEncoded {
    pub fn builder() -> PrivateReplyNotPossibleEncodedBuilder {
        <PrivateReplyNotPossibleEncodedBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct PrivateReplyNotPossibleEncodedBuilder {
    code: Option<String>,
    message: Option<String>,
    request_id: Option<String>,
    reason: Option<PrivateReplyRefusal>,
}

impl PrivateReplyNotPossibleEncodedBuilder {
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

    pub fn reason(mut self, value: PrivateReplyRefusal) -> Self {
        self.reason = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`PrivateReplyNotPossibleEncoded`].
    /// This method will fail if any of the following fields are not set:
    /// - [`reason`](PrivateReplyNotPossibleEncodedBuilder::reason)
    pub fn build(self) -> Result<PrivateReplyNotPossibleEncoded, BuildError> {
        Ok(PrivateReplyNotPossibleEncoded {
            code: self.code,
            message: self.message,
            request_id: self.request_id,
            reason: self
                .reason
                .ok_or_else(|| BuildError::missing_field("reason"))?,
        })
    }
}
